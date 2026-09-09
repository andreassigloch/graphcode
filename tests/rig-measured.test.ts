/**
 * CR-GC-491 — ein Messaufbau, vier Verwendungen.
 *
 * Der Befund, den dieser Test festnagelt: `new GraphCodeHarness(cfg, storage)` faellt bei
 * fehlendem `opts.graphcodeConfig` STILL auf `DEFAULT_CONFIG` zurueck (harness.ts:142). Ein
 * Rig, das so baut, misst auf Default-Budgets — egal was im Repo steht. Heute folgenlos, weil
 * `graphcode.config.jsonc` zeichengleich mit `DEFAULT_METRIC_POLICY` ist; invertierend, sobald
 * ein Budget wandert (CR-SM-303 will genau das).
 *
 * Erster Fall ist der ZEUGE (der alte Weg, dokumentiert falsch), die uebrigen pruefen den neuen.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { openMeasured, discriminate, stampLine } from '../src/surface/measured.js';

/** Ein Zwei-Knoten-Graph — es geht um die Policy, nicht um den Inhalt. */
const FIXTURE = {
  elements: [
    { id: 'FUNC-a', type: 'FUNC', name: 'Elternfunktion' },
    { id: 'FUNC-b', type: 'FUNC', name: 'Kindfunktion' },
  ],
  // `FUNC -compose-> FUNC` ist ein legales TRACE_PATTERN; `SYS -compose-> FUNC` ist es NICHT
  // (erster Entwurf, vom Kuzu-Binder zu Recht abgewiesen — die Fixture war falsch, nicht das Gate).
  traces: [{ source: 'FUNC-a', target: 'FUNC-b', type: 'compose' }],
};

/** Ein Wegwerf-Repo mit einer Config, deren Budget NICHT der Default ist. */
function fixtureRepo(): { dir: string; graph: string } {
  const dir = mkdtempSync(join(tmpdir(), 'measured-fix-'));
  mkdirSync(join(dir, 'docs', 'graph'), { recursive: true });
  const graph = join(dir, 'docs', 'graph', 'test.graph.json');
  writeFileSync(graph, JSON.stringify(FIXTURE));
  // boundaryWidth 5 -> 2: der Wert, an dem CR-SM-303 drehen will.
  // VOLLSTAENDIG: `GraphcodeConfigSchema` weist eine Teil-Policy ab (CR-GC-329 — eine Config,
  // die da ist, muss stimmen; kein stilles Auffuellen). Nur `boundaryWidth` weicht vom Default ab.
  writeFileSync(
    join(dir, 'graphcode.config.jsonc'),
    JSON.stringify({ metricPolicy: { ...DEFAULT_METRIC_POLICY, boundaryWidth: { warning: 2 } }, focusThreshold: 0.5 }),
  );
  return { dir, graph };
}

describe('CR-GC-491: der Messaufbau traegt die Repo-Config, nicht den Default', () => {
  it('ZEUGE: der handgebaute Harness sieht das Repo-Budget NICHT (der Defekt)', async () => {
    const { dir } = fixtureRepo();
    const store = mkdtempSync(join(tmpdir(), 'measured-store-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(store, 'kuzu') });
    const harness = new GraphCodeHarness(
      { repoRoot: dir, scope: { workspaceId: 'w', systemId: 's' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage,
      undefined,
      { lockDir: store },
    );
    await harness.initialize();
    // Die Config im Repo sagt 2. Der handgebaute Harness sagt 5 — und meldet es nicht.
    expect(harness.getMetricPolicy().boundaryWidth?.warning).toBe(5);
    expect(harness.getGraphcodeConfig().source).toBe('default');
    await harness.close();
    rmSync(dir, { recursive: true, force: true });
    rmSync(store, { recursive: true, force: true });
  });

  it('openMeasured laedt die Config, die beim Graphen liegt', async () => {
    const { dir, graph } = fixtureRepo();
    const m = await openMeasured({ graph, systemId: 's' });
    expect(m.policy.boundaryWidth?.warning).toBe(2);
    expect(m.provenance.policy.source).toBe('file');
    expect(m.provenance.policy.from).toBe(join(dir, 'graphcode.config.jsonc'));
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('ohne Config meldet der Stempel `default` — nie stillschweigend', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'measured-nocfg-'));
    mkdirSync(join(dir, 'docs', 'graph'), { recursive: true });
    const graph = join(dir, 'docs', 'graph', 'test.graph.json');
    writeFileSync(graph, JSON.stringify(FIXTURE));
    const m = await openMeasured({ graph, systemId: 's' });
    expect(m.provenance.policy.source).toBe('default');
    expect(m.provenance.policy.from).toBeNull();
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('der Stempel benennt Graph, Versionen und Code — ohne Stempel keine Zahl', async () => {
    const { dir, graph } = fixtureRepo();
    const m = await openMeasured({ graph, systemId: 's' });
    expect(m.provenance.graph.path).toBe(graph);
    expect(m.provenance.graph.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(m.provenance.graph.elements).toBe(2);
    expect(m.provenance.versions.rules).toMatch(/^\d+\.\d+\.\d+$/);
    expect(m.provenance.code.sha).toMatch(/^[0-9a-f]{7,40}$/);
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('der Store liegt beim owner.lock — das Schloss bewacht den Store (CR-GC-218)', async () => {
    const { dir, graph } = fixtureRepo();
    const m = await openMeasured({ graph, systemId: 's' });
    expect(m.harness.getStoreDir()).toBe(join(m.repoRoot, '.graphcode'));
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('der Graph ist wirklich im Store — geseedet, nicht nur kopiert', async () => {
    const { dir, graph } = fixtureRepo();
    const m = await openMeasured({ graph, systemId: 's' });
    // `SYS-s` legt der Harness beim Seed selbst an (Systemwurzel aus `scope.systemId`) — das
    // ist Produktionsverhalten und gehoert in die Erwartung, nicht wegassertiert.
    expect(m.graph().nodes.map((n) => n.uid).sort()).toEqual(['FUNC-a', 'FUNC-b', 'SYS-s']);
    expect(Object.keys(m.tools)).toContain('graph_mutate');
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('CR-GC-491: Blindheitsausgang statt Rang', () => {
  // Der Regressionsfall aus CR-SM-291 Satz F: vier Kandidaten, alle Delta 0 — funf Lesarten
  // meldeten "bestanden", der Rang kam aus dem alphabetischen Tiebreak.
  it('vier Kandidaten mit identischem Profil ergeben blind, KEINEN Rang', () => {
    const d = discriminate(
      [{ id: 'D' }, { id: 'A' }, { id: 'C' }, { id: 'B' }],
      () => 0,
      { name: 'steerScore' },
    );
    expect(d.blind).toBe(true);
    expect(d.ranked).toBeNull();
    expect(d.spread).toBe(0);
    expect(d.reason).toContain('steerScore');
  });

  it('bei Spreizung > 0 rankt es aufsteigend und ist nicht blind', () => {
    const d = discriminate([{ id: 'A', v: 3 }, { id: 'B', v: 1 }], (c) => c.v as number, { name: 'v' });
    expect(d.blind).toBe(false);
    expect(d.spread).toBe(2);
    expect(d.ranked?.map((c) => (c as { id: string }).id)).toEqual(['B', 'A']);
  });
});

/**
 * CR-GC-493: Greenfield — ein Messaufbau OHNE Graphen.
 *
 * Die beiden armC-Rigs autorieren aus dem Leeren; sie bauten von Hand, weil `openMeasured` einen
 * Graphen verlangte. Der Stempel muss die Abwesenheit dann SAGEN, nicht einen Hash erfinden.
 */
describe('CR-GC-493: der leere Start ist ein Fall, kein Sonderfall', () => {
  it('ohne graph entsteht ein leeres, benutzbares Wegwerf-Repo', async () => {
    const m = await openMeasured({ systemId: 'greenfield' });
    try {
      expect(m.provenance.graph).toBeNull();
      expect(Object.keys(m.tools)).toContain('graph_mutate');
      // WIRKLICH leer: die Systemwurzel entsteht beim Seed, nicht beim `initialize` — ohne
      // Graphen gibt es keinen Seed. Genau das brauchen die Autorier-Rigs (Greenfield).
      expect(m.graph().nodes).toEqual([]);
    } finally {
      await m.close();
    }
  });

  it('der Stempel sagt die Abwesenheit, statt einen Hash zu erfinden', async () => {
    const m = await openMeasured({ systemId: 'greenfield' });
    try {
      expect(stampLine(m.provenance)).toContain('graph —');
      expect(stampLine(m.provenance)).toContain('rules ');
    } finally {
      await m.close();
    }
  });
});

/**
 * CR-GC-496: fremde Repo-Wurzel bei Wegwerf-Store.
 *
 * `createHarness` leitete den Store-Ort AUS `repoRoot` ab. Damit hingen drei Dinge aneinander,
 * die getrennt gehoeren: Urteilsquelle (`graphcode.config.jsonc`), Aufloesungsbasis (`realRef`,
 * `missingRefs`, RC-*) und Store-Ort. Wer die ersten beiden am echten Repo brauchte und den
 * dritten im Temp, fiel aus `createHarness` heraus — und verlor still die Config-Ladung und den
 * policy-gebauten Descriptor. Genau das tun `armB.mjs` und `tests/conformance.test.ts`.
 */
describe('CR-GC-496: die Wurzel ist echt, der Store ist Wegwerf', () => {
  const REPO = join(__dirname, '..');

  it('Urteilsquelle und Aufloesungsbasis bleiben am echten Repo, der Store nicht', async () => {
    const before = statSync(join(REPO, '.graphcode', 'kuzu')).mtimeMs;
    const m = await openMeasured({
      graph: join(REPO, 'docs', 'graph', 'graphcode.graph.json'),
      repoRoot: REPO,
      systemId: 'graphcode',
    });
    try {
      // Die Wurzel ist echt: von hier kommen Config und realRef-Aufloesung.
      expect(m.harness.getRepoRoot()).toBe(REPO);
      expect(m.provenance.policy.source).toBe('file');
      expect(m.policy.boundaryWidth?.warning).toBe(5); // aus graphcode.config.jsonc
      // Der Store ist es nicht — und der owner.lock liegt bei ihm (CR-GC-218).
      expect(m.harness.getStoreDir().startsWith(REPO)).toBe(false);
      expect(m.harness.getStoreDir()).toBe(join(m.storeRoot, '.graphcode'));
      expect(m.graph().nodes.length).toBeGreaterThan(100);
    } finally {
      await m.close();
    }
    // Der LIVE-Store des echten Repos wurde nicht angefasst (REQ-single-kuzu-owner).
    expect(statSync(join(REPO, '.graphcode', 'kuzu')).mtimeMs).toBe(before);
  });

  it('ohne repoRoot bleibt alles im Wegwerf-Repo — das ist der Vorgabefall', async () => {
    const m = await openMeasured({ systemId: 'greenfield' });
    try {
      expect(m.harness.getRepoRoot()).toBe(m.storeRoot);
      expect(m.repoRoot).toBe(m.storeRoot);
    } finally {
      await m.close();
    }
  });
});
