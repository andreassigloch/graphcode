/**
 * TEST-selective-test-audit (CR-GC-381) — der Auswahl-Resolver und sein Messinstrument.
 *
 * Zwei Dinge werden hier abgesichert, und beide sind schon einmal schiefgegangen:
 *
 * 1. **Ein Traversal, zwei Aufrufer.** `graph_tests` löst über den Kuzu-Store auf, das
 *    Audit über den committeten Snapshot. Wären das zwei Implementierungen, könnte die
 *    Messung grün melden, was der Produktionspfad anders sieht. Der Paritätstest fährt
 *    denselben ChangeSet über beide Wege gegen dieselbe Fixture.
 *
 * 2. **Eine leere Auswahl ist kein grüner Lauf.** Genau das tut `graph_tests` heute noch,
 *    wenn nichts auflösbar ist (`vitest run --passWithNoTests`, gemessen an `src/upgrade.ts`
 *    im Spike). Die Auswahl-Policy des Audits muss bei jeder nicht auflösbaren Datei den
 *    VOLLLAUF liefern — nicht die leere Menge.
 *
 * Realer Disk-Kuzu (temp dir, nie `:memory:`), realer Snapshot, reales Repo. Keine Mocks,
 * keine festen Datei-Zahlen (die wandern mit jedem CR — sie werden aus dem Repo abgeleitet).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/harness.js';
import { impactedTests } from '../src/test-selection.js';
import {
  buildContext,
  coverage,
  recall,
  potential,
  selectForChange,
  snapshotToGraph,
  type AuditContext,
} from '../src/test-selection-audit.js';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/**
 * Die Realisierungskette in ihrer vollen Länge — der Fall, den ein einzelner gerichteter
 * Fetch NICHT erreicht, weil er zweimal die Richtung wechselt:
 *   TEST-CODE -verify-> REQ-1 <-satisfy- FUNC-1 -allocate-> MOD-1
 * Dazu ein unbeteiligter Zweig, der nie mitkommen darf.
 */
const fixture = {
  elements: [
    { id: 'REQ-1', type: 'REQ', name: 'Req 1', description: 'die erfüllte Anforderung' },
    { id: 'MOD-1', type: 'MOD', name: 'Mod 1', description: 'das geänderte Modul' },
    { id: 'FUNC-1', type: 'FUNC', name: 'Func 1', description: 'in MOD-1 alloziert, erfüllt REQ-1' },
    {
      id: 'TEST-CODE',
      type: 'TEST',
      name: 'Test Code',
      description: 'verifiziert REQ-1',
      testRefs: [{ file: 'tests/alpha.test.ts', tool: 'vitest', level: 'unit' }],
    },
    { id: 'REQ-2', type: 'REQ', name: 'Req 2', description: 'unbeteiligt' },
    {
      id: 'TEST-OTHER',
      type: 'TEST',
      name: 'Test Other',
      description: 'verifiziert REQ-2',
      testRefs: [{ file: 'tests/beta.test.ts', tool: 'vitest', level: 'unit' }],
    },
  ],
  traces: [
    { source: 'FUNC-1', target: 'MOD-1', type: 'allocate' },
    { source: 'FUNC-1', target: 'REQ-1', type: 'satisfy' },
    { source: 'TEST-CODE', target: 'REQ-1', type: 'verify' },
    { source: 'TEST-OTHER', target: 'REQ-2', type: 'verify' },
  ],
};

const fixtureGraph = (): Graph => snapshotToGraph(fixture);

describe('impactedTests: die Kantensemantik der Auswahl', () => {
  it('erreicht vom geänderten MOD über allocate → satisfy → verify den TEST', () => {
    const result = impactedTests(fixtureGraph(), ['MOD-1']);

    expect(result.testIds).toEqual(['TEST-CODE']);
    expect(result.anchors).toContain('FUNC-1'); // MOD ← FUNC (allocate, eingehend)
    expect(result.anchors).toContain('REQ-1'); // FUNC → REQ (satisfy, ausgehend)
  });

  it('lässt den unbeteiligten Zweig draußen', () => {
    const result = impactedTests(fixtureGraph(), ['MOD-1']);

    expect(result.testIds).not.toContain('TEST-OTHER');
    expect(result.nodes.map((n) => n.uid)).not.toContain('REQ-2');
  });

  it('degeneriert bei einem REQ-ChangeSet auf dessen verify-Abhängige', () => {
    const result = impactedTests(fixtureGraph(), ['REQ-1']);

    expect(result.testIds).toEqual(['TEST-CODE']);
    // Kein Abstieg in die Realisierung: FUNC-1 zeigt AUF REQ-1, wird also nicht Anker.
    expect(result.anchors).not.toContain('FUNC-1');
  });

  it('gibt nur Kanten zurück, deren beide Enden im Ergebnis stehen', () => {
    const result = impactedTests(fixtureGraph(), ['MOD-1']);
    const kept = new Set(result.nodes.map((n) => n.uid));

    for (const edge of result.edges) {
      expect(kept.has(edge.sourceId)).toBe(true);
      expect(kept.has(edge.targetId)).toBe(true);
    }
  });
});

describe('Parität: Store-Pfad und Snapshot-Pfad sehen dasselbe', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-selection-parity-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(
      { repoRoot: tmp, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage,
    );
    await harness.initialize();
    await harness.importGraph(fixture);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('harness.testImpact() liefert denselben Knotensatz wie impactedTests() über den geladenen Graphen', async () => {
    const viaStore = await harness.testImpact(['MOD-1'], 1);
    const loaded = await harness.getStore().loadGraph(harness.getScope());
    const viaFunction = impactedTests(loaded, ['MOD-1'], 1);

    const uids = (g: { nodes: Array<{ uid: string }> }): string[] => g.nodes.map((n) => n.uid).sort();
    expect(uids(viaStore)).toEqual(uids(viaFunction));
    expect(uids(viaStore)).toContain('TEST-CODE');
  });
});

describe('Audit über das echte Repo', () => {
  let ctx: AuditContext;

  beforeAll(() => {
    ctx = buildContext(REPO_ROOT);
  });

  it('zählt jede Quell- und Testdatei genau einmal, gebunden oder nicht', () => {
    const cov = coverage(ctx);

    expect(cov.sources.total).toBeGreaterThan(0);
    expect(cov.tests.total).toBeGreaterThan(0);
    expect(cov.sources.bound + cov.sources.unbound.length).toBe(cov.sources.total);
    expect(cov.tests.anchored + cov.tests.unanchored.length).toBe(cov.tests.total);
    // Diese Datei ist selbst ein Testobjekt des Repos — die Zählung muss sie kennen.
    expect(ctx.allTests).toContain('tests/test-selection.audit.test.ts');
  });

  it('misst Recall gegen tatsächlich importierende Tests, nie gegen sich selbst', () => {
    const rec = recall(ctx);

    expect(rec.hit).toBeLessThanOrEqual(rec.coupled);
    expect(rec.hit).toBeLessThanOrEqual(rec.selected);
    expect(rec.ratio).toBeGreaterThanOrEqual(0);
    expect(rec.ratio).toBeLessThanOrEqual(1);
    // Jede getroffene Datei existiert wirklich — ein Recall über Phantompfade wäre wertlos.
    for (const row of rec.rows) expect(existsSync(join(REPO_ROOT, row.file))).toBe(true);
  });

  it('eine nicht auflösbare Quelldatei erzwingt den VOLLLAUF, nie die leere Auswahl', () => {
    const result = selectForChange(['src/__gibt-es-nicht__.ts'], ctx);

    expect(result.complete).toBe(false);
    expect(result.reason).toMatch(/^full run/);
    expect(result.files).toEqual([...ctx.allTests].sort()); // alles, nicht nichts
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('eine Abhängigkeits- oder Build-Änderung erzwingt den Volllauf', () => {
    for (const trigger of ['package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts']) {
      const result = selectForChange([trigger], ctx);
      expect(result.complete, trigger).toBe(false);
      expect(result.files.length, trigger).toBe(ctx.allTests.length);
    }
  });

  it('eine geänderte Testdatei wählt sich selbst, ohne den Rest mitzuziehen', () => {
    const target = 'tests/test-selection.audit.test.ts';
    const result = selectForChange([target], ctx);

    expect(result.complete).toBe(true);
    expect(result.files).toContain(target);
    expect(result.files.length).toBeLessThan(ctx.allTests.length);
  });

  it('der Graph-Anteil ist immer eine Teilmenge der Gesamtauswahl (A/B-Voraussetzung)', () => {
    const bound = coverage(ctx).sources;
    const someBoundFile = ctx.allSources.find((f) => !bound.unbound.includes(f));
    expect(someBoundFile).toBeDefined();

    const result = selectForChange([someBoundFile!], ctx);
    for (const file of result.graphOnly) expect(result.files).toContain(file);
  });

  it('über die letzte Commit-Historie gilt: unvollständig ⇒ Volllauf', () => {
    const pot = potential(REPO_ROOT, ctx, 20);

    expect(pot.commits).toBeGreaterThan(0);
    expect(pot.full).toBe(pot.commits * ctx.allTests.length);
    for (const commit of pot.perCommit) {
      if (!commit.complete) expect(commit.selected, commit.sha).toBe(ctx.allTests.length);
    }
    // Die Decke darf nie schlechter sein als der Lauf mit Fallback.
    expect(pot.ceiling).toBeLessThanOrEqual(pot.selected);
  });
});
