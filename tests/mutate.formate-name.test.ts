/**
 * TEST-formate-name (CR-GC-321) — `__name` ist entdeckbar, der `name = uid`-Fallback ist laut.
 *
 * Der gemessene Schaden (Session 2026-08-10, Fremdrepo): 87 von 134 Knoten trugen
 * ihren uid als Namen, weil `+ uid|text` zwei positionale Felder hat und der Name
 * als `__name`-Attribut reist — was in keiner Tool-Beschreibung stand. Sichtbar
 * wurde es erst mehrere Arbeitsschritte später in den generierten Sichten.
 *
 * Zwei Hälften, beide hier geprüft:
 *   1. ENTDECKBARKEIT — die formatE-Feldbeschreibung nennt `__name`;
 *      `graph_authoring_guide` liefert ein Beispiel, das der Codec wirklich frisst
 *      (REQ-N03: geprüft, nicht behauptet).
 *   2. LAUTSTÄRKE — ein Batch ohne `__name` meldet `nameWarning` mit den uids,
 *      im Apply UND im dryRun, ohne `success`/`tier`/`violations` anzufassen.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { GraphCodeCodec } from '../src/projections/codec.js';
import { attributesFor, formatEExampleFor } from '../src/projections/authoring-example.js';
import { ReqKind, TRACE_PATTERNS } from '@sigloch/contracts/se';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'Beispielsystem', description: 'Ein System.' },
    {
      id: 'REQ-seed',
      type: 'REQ',
      name: 'Bestehende Anforderung',
      description: 'Das System muss einen frueheren Graph-Stand herstellen koennen.',
    },
    {
      id: 'TEST-seed',
      type: 'TEST',
      name: 'Seed-Test',
      description: 'Prueft die bestehende Anforderung.',
    },
    {
      id: 'FUNC-seed',
      type: 'FUNC',
      name: 'Seed-Funktion',
      description: 'Erfuellt die bestehende Anforderung.',
    },
  ],
  traces: [],
};

/**
 * Die Kanten, die jeden neuen REQ sofort verifiziert und aufgeloest machen —
 * sonst blockt das Gate an R-01 und der Namensfall waere gar nicht messbar.
 */
const BINDING_EDGES =
  '\n## Edges\n' +
  '+ TEST-seed -verify-> REQ-alpha, REQ-beta\n' +
  '+ FUNC-seed -satisfy-> REQ-alpha, REQ-beta\n';

/** Zwei neue REQ OHNE `__name` — der stille Fallback-Fall. */
const UNNAMED_BATCH =
  '## Nodes\n### REQ\n' +
  '+ REQ-alpha|Das System muss den Namen eines Knotens sichtbar machen.\n' +
  '@kinds ["functional"]\n' +
  '+ REQ-beta|Das System muss den Fallback melden.\n' +
  '@kinds ["functional"]\n' +
  BINDING_EDGES;

/** Dieselben zwei REQ MIT `__name` — inline und als Folgezeile. */
const NAMED_BATCH =
  '## Nodes\n### REQ\n' +
  '+ REQ-alpha|Das System muss den Namen eines Knotens sichtbar machen. [__name:Sichtbarer Name]\n' +
  '@kinds ["functional"]\n' +
  '+ REQ-beta|Das System muss den Fallback melden.\n' +
  '@__name Fallback melden, laut\n' +
  '@kinds ["functional"]\n' +
  BINDING_EDGES;

/** Kanten zwischen bestehenden Knoten (CR-GC-310) — kein Knoten, also kein Namensfall. */
const EDGE_ONLY = '## Edges\n+ TEST-seed -verify-> REQ-seed\n';

type MutateOut = {
  success: boolean;
  tier: string;
  mutations: number;
  violations: unknown[];
  nameWarning?: string;
};

describe('TEST-formate-name: der stille name=uid-Fallback wird laut (CR-GC-321)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-formate-name-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(SEED);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  // REQ-N04
  it('meldet die uids ohne __name als nameWarning', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: UNNAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.nameWarning, 'nameWarning fehlt trotz fehlender __name').toBeDefined();
    expect(res.nameWarning).toContain('REQ-alpha');
    expect(res.nameWarning).toContain('REQ-beta');
    expect(res.nameWarning).toContain('__name');
  });

  // REQ-N06 — reine Zusatzinformation
  it('laesst success, tier und die persistierten Daten unveraendert', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: UNNAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.tier).toBe('auto-apply'); // das Pass-Tier des 3-Tier-Verdicts
    expect(res.mutations).toBe(6); // 2 Knoten + 4 Kanten
    // Der Fallback selbst bleibt, wie er ist — gemeldet, nicht repariert.
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-alpha')?.name).toBe('REQ-alpha');
  });

  // REQ-N05 (a) — alle Knoten benannt
  it('meldet nichts, wenn jeder Knoten __name traegt (inline wie als @-Zeile)', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: NAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
    const nodes = harness.getGraph().nodes;
    expect(nodes.find((n) => n.uid === 'REQ-alpha')?.name).toBe('Sichtbarer Name');
    expect(nodes.find((n) => n.uid === 'REQ-beta')?.name).toBe('Fallback melden, laut');
  });

  // REQ-N05 (b) — reiner Kanten-Batch
  it('meldet nichts fuer einen reinen Kanten-Batch', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: EDGE_ONLY, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
  });

  // REQ-N05 (c) — der commands-Pfad
  it('meldet nichts auf dem commands-Pfad (dort ist name explizite Autorenabsicht)', async () => {
    const res = (await tools.graph_mutate.handler({
      commands: [
        {
          op: 'add-node',
          node: { uid: 'REQ-gamma', type: 'REQ', name: 'REQ-gamma', description: 'Das System muss den Pfad trennen.', attributes: { kinds: ['functional'] } },
        },
        { op: 'add-edge', edge: { sourceId: 'TEST-seed', targetId: 'REQ-gamma', edgeType: 'verify' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-seed', targetId: 'REQ-gamma', edgeType: 'satisfy' } },
      ],
      consumerId: 't',
    })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
  });

  // REQ-N07 — sonst meldet der Preview sauber und der Apply verliert die Namen
  it('meldet den Fall auch im dryRun', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: UNNAMED_BATCH,
      dryRun: true,
      consumerId: 't',
    })) as MutateOut;

    expect(res.nameWarning).toBeDefined();
    expect(res.nameWarning).toContain('REQ-alpha');
    // dryRun bleibt dryRun: nichts persistiert.
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-alpha')).toBe(false);
  });

  // REQ-N01 — Entdeckbarkeit an der Schreib-Oberflaeche
  it('nennt __name in der formatE-Feldbeschreibung, inkl. beider Formen und des Fallbacks', () => {
    const shape = (tools.graph_mutate.inputSchema as unknown as { def: { shape: Record<string, { description?: string }> } }).def.shape;
    const desc = shape.formatE.description ?? '';

    expect(desc).toContain('__name');
    expect(desc).toContain('[__name:');
    expect(desc).toContain('@__name');
    expect(desc.toLowerCase()).toMatch(/uid zum namen|uid becomes the name/);
  });

  // REQ-N02 / REQ-N03 — das Beispiel ist geprueft, nicht behauptet
  it('liefert je Typ ein formatEExample, das der Codec zu einem Knoten mit lesbarem Namen decodiert', async () => {
    for (const type of ['REQ', 'FUNC', 'TEST']) {
      const guide = await tools.graph_authoring_guide.handler({ type });
      const example = (guide as { formatEExample: string }).formatEExample;

      expect(example, `formatEExample fehlt fuer ${type}`).toBeDefined();
      expect(example).toContain('__name');

      const decoded = new GraphCodeCodec().decode(example);
      // CR-GC-625: der Block traegt jetzt auch die Ziele der Fan-out-Zeile. Der ANKER bleibt
      // genau einer — was hinzukam, sind seine Kantenziele, nicht ein zweites Beispiel.
      const anker = decoded.nodes.filter((n) => n.uid === `${type}-example`);
      expect(anker).toHaveLength(1);
      expect(anker[0].type).toBe(type);
      expect(anker[0].name).not.toBe(anker[0].uid);
      expect(anker[0].name.length).toBeGreaterThan(0);
      expect(decoded.nodes.every((n) => n.name !== n.uid), 'auch die Ziele tragen __name').toBe(true);
    }
  });

  /**
   * CR-GC-625 — der Fan-out ist im Codec da, seit CR-GC-268 auch im Emit-Zweig; gezeigt wurde er
   * nie. Gemessen am Rig-Lauf `opus5-16`: 343 Kantenschreibungen in 194 Gruppen, 149 Zeilen
   * (43 %) unnoetig einzeln, Fan-out 0-mal genutzt — und im ganzen Stream kam keine einzige
   * Mehrziel-Zeile vor, er konnte sie also auch nicht abschauen.
   *
   * POSITIVKONTROLLE: schreibt man die Zeile in `formatEExampleFor` auf ein einzelnes Ziel
   * zurueck, wird dieser Fall rot (geprueft am 2026-09-23) — der Test haengt an der GRUPPE,
   * nicht an der Existenz irgendeiner Kante.
   */
  it('das Beispiel zeigt den Fan-out, und zwar an einem ECHTEN Muster des Typs', async () => {
    const muster = TRACE_PATTERNS as ReadonlyArray<{ source: string; target: string; type: string }>;
    for (const type of ['REQ', 'FUNC', 'TEST', 'MOD', 'UC']) {
      const guide = await tools.graph_authoring_guide.handler({ type });
      const example = (guide as { formatEExample: string }).formatEExample;

      // EINE Zeile, MEHRERE Kanten — der Beweis liegt im Decode, nicht im Text.
      const fanoutZeilen = example.split('\n').filter((l) => /^\+ .+ -\w+-> .+,/.test(l));
      expect(fanoutZeilen, `${type}: keine Mehrziel-Zeile im Beispiel`).toHaveLength(1);

      const decoded = new GraphCodeCodec().decode(example);
      const ausAnker = decoded.edges.filter((e) => e.sourceId === `${type}-example`);
      expect(ausAnker.length, `${type}: die eine Zeile muss mehrere Kanten ergeben`).toBeGreaterThan(1);
      expect(new Set(ausAnker.map((e) => e.edgeType)).size, 'alle Ziele derselben Kantenart').toBe(1);

      // Das Muster ist keines aus der Luft: Quelle, Kantenart und Zieltyp stehen in TRACE_PATTERNS.
      const zielTyp = decoded.nodes.find((n) => n.uid === ausAnker[0].targetId)!.type;
      expect(
        muster.some((p) => p.source === type && p.type === ausAnker[0].edgeType && p.target === zielTyp),
        `${type} -${ausAnker[0].edgeType}-> ${zielTyp} ist kein TRACE_PATTERN`,
      ).toBe(true);
    }
  });

  it('SCHEMA hat kein ausgehendes Muster — und bekommt deshalb keinen erfundenen Kantenblock', async () => {
    const guide = await tools.graph_authoring_guide.handler({ type: 'SCHEMA' });
    const example = (guide as { formatEExample: string }).formatEExample;
    expect(example).not.toContain('## Edges');
    expect(new GraphCodeCodec().decode(example).edges).toHaveLength(0);
  });
});

describe('CR-GC-581: kinds steht im Guide — Werte UND Schreibweise', () => {
  it('der REQ-Guide nennt kinds mit allen ReqKind-Werten und der Folgezeilen-Syntax', () => {
    const kinds = attributesFor('REQ').find((a) => a.key === 'kinds');
    expect(kinds, 'ohne kinds im Guide sucht der Autor im Quellcode (Runde 7: bis 31-mal)').toBeDefined();
    expect(kinds!.enumValues).toEqual(ReqKind.options);
    expect(kinds!.enumValues).toEqual(expect.arrayContaining(['postcondition', 'precondition']));
    expect(kinds!.syntax).toBe('@kinds ["postcondition"]');
  });

  it('das REQ-Beispiel traegt kinds, und der Codec liest es als Liste', () => {
    const decoded = new GraphCodeCodec().decode(formatEExampleFor('REQ'));
    expect(decoded.nodes[0].kinds ?? decoded.nodes[0].attributes?.kinds).toEqual(['functional']);
  });

  it('die dokumentierte Syntax selbst decodiert — sonst waere der Hinweis eine Falle', () => {
    const decoded = new GraphCodeCodec().decode(
      '## Nodes\n### REQ\n+ REQ-post|Nach dem Lauf liegt das Ergebnis vor. [__name:Ergebnis liegt vor]\n' +
        attributesFor('REQ').find((a) => a.key === 'kinds')!.syntax + '\n',
    );
    expect(decoded.nodes[0].kinds ?? decoded.nodes[0].attributes?.kinds).toEqual(['postcondition']);
  });

  it('Typen ohne kinds bekommen keins angedichtet', () => {
    expect(attributesFor('FUNC').some((a) => a.key === 'kinds')).toBe(false);
    expect(formatEExampleFor('FUNC')).not.toContain('@kinds');
  });
});

describe('formatEExampleFor: der Musterblock selbst (CR-GC-321)', () => {
  it('interpoliert den angefragten Typ in die Sektion und die uid', () => {
    const example = formatEExampleFor('MOD');
    expect(example).toContain('### MOD');
    expect(example).toContain('+ MOD-example|');
  });
});

/**
 * CR-GC-536 / ITEM-2026-183 — die Gegenprobe AM LEBENDEN GATE, nicht am Codec allein.
 *
 * Der Befund, der diesen CR ausgeloest hat: eine Beschreibung mit Zeilenumbruch wurde
 * nicht nur abgeschnitten — die uebergelaufene Zeile wurde ein EIGENER Knoten (uid = der
 * Resttext, Typ = die offene `### <TYPE>`-Sektion), und `success` war TRUE. Einzige
 * Meldung war R-17 "empty system", eine Warnung, die nie blockt. Das inline-Attribut
 * `[__name:...]` haftete dabei am Phantom, nicht am gemeinten Knoten — deshalb steht
 * dieser Fall hier, bei der Namens-Gruppe: die Warnung zeigte auf das falsche Opfer.
 *
 * Der Schutz beim REQ war ein Zufall der Regellage (R-01 blockte), kein Schutz. Jetzt
 * blockt der Parser selbst, also auch beim SYS.
 */
describe('CR-GC-536: der Zeilenumbruch erzeugt keinen Phantom-Knoten mehr (ITEM-2026-183)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  /** Exakt die Form der Reproduktion: der Umbruch traegt das inline-Attribut mit sich. */
  const PHANTOM_BATCH =
    '## Nodes\n### SYS\n' +
    '+ SYS-phantom|Ein System mit einer Beschreibung, die\n' +
    'umbricht [__name:Gemeinter Name]\n';

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-formate-phantom-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(SEED);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('dryRun: success ist FALSE und der Fehler nennt den fehlenden Operator', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: PHANTOM_BATCH,
      dryRun: true,
      consumerId: 't',
    })) as MutateOut & { error?: string };

    expect(res.success, JSON.stringify(res)).toBe(false);
    expect(JSON.stringify(res)).toMatch(/without an operator prefix|Zeilenumbruch/);
    // Und nicht etwa zwei Mutationen, wie vor der Haertung.
    expect(res.mutations ?? 0).toBe(0);
  });

  it('apply: weder der gemeinte noch der Phantom-Knoten landen im Speicher', async () => {
    await tools.graph_mutate.handler({ formatE: PHANTOM_BATCH, consumerId: 't' });

    const uids = harness.getGraph().nodes.map((n) => n.uid);
    expect(uids).not.toContain('SYS-phantom');
    // Der Phantom trug den Resttext als uid — genau der Knoten, der still entstand.
    expect(uids.some((u) => u.includes('umbricht'))).toBe(false);
    expect(uids.sort()).toEqual(['FUNC-seed', 'REQ-seed', 'SYS-x', 'TEST-seed']);
  });
});
