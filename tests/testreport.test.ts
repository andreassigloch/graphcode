/**
 * TEST-testreport (CR-GC-327) — der Rückweg: Testergebnis in den Graphen, Prüfreport heraus.
 *
 * Der gemessene Zustand vor diesem CR: auf graph-view-edit feuerte VR-01 für ALLE 14
 * TEST-Knoten (keiner trug je ein `testResult`), während die Suite dort 537 von 537
 * grün lief — und `docs/views/testmatrix.md` zeigte trotzdem für alle 72 REQ ein `✓`.
 * Dieses Häkchen bedeutete ausschließlich „es existiert eine verify-Kante".
 *
 * Die drei Stellen, an denen ein Prüfreport lügen kann, und die deshalb hier stehen:
 *   1. eine Runner-Datei ohne passenden `testRefs`-Eintrag wird still verworfen → `unresolved`,
 *   2. ein TEST ohne Lauf wird als grün gelesen → expliziter Zustand `not-run`,
 *   3. die VCRM zeigt Kante und Ergebnis in EINER Spalte → zwei Spalten.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { parseVitestJson, verificationReport } from '../src/testreport.js';
import { renderTestMatrix } from '../src/views/incose.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'testreport-ws', systemId: 'testreport' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

const node = (uid: string, type: string, name: string, attributes: Record<string, unknown> = {}): MutateCommand => ({
  op: 'add-node',
  node: { uid, type, name, description: `${name}.`, attributes },
});
const edge = (sourceId: string, edgeType: string, targetId: string): MutateCommand => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

/**
 * REQ-ran wird von einem gebundenen TEST verifiziert (der Lauf trifft ihn),
 * REQ-never von einem gebundenen TEST, den kein Lauf berührt.
 */
const SEED: MutateCommand[] = [
  node('SYS-t', 'SYS', 'Test system'),
  node('REQ-ran', 'REQ', 'Requirement with a run'),
  node('REQ-never', 'REQ', 'Requirement never run'),
  node('TEST-ran', 'TEST', 'Ran test', { testRefs: [{ file: 'tests/ran.test.ts', tool: 'vitest' }] }),
  node('TEST-never', 'TEST', 'Never run test', { testRefs: [{ file: 'tests/never.test.ts', tool: 'vitest' }] }),
  node('MOD-t', 'MOD', 'Test module'),
  edge('SYS-t', 'compose', 'REQ-ran'),
  edge('SYS-t', 'compose', 'REQ-never'),
  edge('TEST-ran', 'verify', 'REQ-ran'),
  edge('TEST-never', 'verify', 'REQ-never'),
  edge('MOD-t', 'satisfy', 'REQ-ran'),
  edge('MOD-t', 'satisfy', 'REQ-never'),
];

/** Ein echtes vitest `--reporter=json`-Fragment: ein Treffer, ein Fremdling. */
const VITEST_JSON = JSON.stringify({
  numTotalTestSuites: 2,
  testResults: [
    {
      name: '/abs/repo/tests/ran.test.ts',
      status: 'passed',
      assertionResults: [{ status: 'passed' }, { status: 'passed' }],
    },
    {
      name: 'tests/orphan.test.ts',
      status: 'passed',
      assertionResults: [{ status: 'passed' }],
    },
  ],
});

describe('TEST-testreport: Ergebnisse zurueck in den Graphen (CR-GC-327)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-testreport-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('schreibt das Ergebnis ueber testRefs[].file an den Eintrag — durch das Gate', async () => {
    const res = await tools.graph_test_ingest.handler({ report: VITEST_JSON, consumerId: 'runner' });

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.assignments).toContainEqual({ testUid: 'TEST-ran', file: '/abs/repo/tests/ran.test.ts', result: 'passed' });
    // CR-SM-231b: das Ergebnis steht am EINTRAG, nicht am Knoten — bei n Laeufen koennte ein
    // Knoten-Attribut nicht sagen, welcher gemeint ist.
    const ran = harness.getGraph().nodes.find((n) => n.uid === 'TEST-ran')!;
    const refs = ran.attributes?.testRefs as Array<{ file: string; result?: string; ranAt?: string }>;
    expect(refs.find((r) => r.file === 'tests/ran.test.ts')?.result).toBe('passed');
    expect(refs.find((r) => r.file === 'tests/ran.test.ts')?.ranAt).toBeDefined();
    // Kein Seitenkanal: der Ingest liegt im Audit-Trail wie jeder gated Write.
    const trail = await tools.audit_trail.handler({ limit: 10 });
    expect(trail.entries.some((e) => e.consumerId === 'runner')).toBe(true);
  });

  it('meldet eine Runner-Datei ohne passenden testRefs-Eintrag als unresolved statt sie zu verwerfen', async () => {
    const res = await tools.graph_test_ingest.handler({ report: VITEST_JSON, consumerId: 'runner' });

    expect(res.unresolved.map((u) => u.file)).toEqual(['tests/orphan.test.ts']);
    expect(res.unresolved[0].reason).toMatch(/testRefs/);
  });

  it('laesst einen TEST ohne Lauf als `not-run` stehen — nicht als bestanden, nicht weg', async () => {
    await tools.graph_test_ingest.handler({ report: VITEST_JSON, consumerId: 'runner' });
    const report = await tools.graph_test_report.handler({});

    const never = report.requirements.find((r) => r.reqUid === 'REQ-never')!;
    expect(never.hasVerifyTrace, 'die verify-Kante existiert').toBe(true);
    expect(never.passed, 'ohne Lauf ist nichts belegt').toBe(false);
    expect(never.tests).toHaveLength(1);
    expect(never.tests[0].result).toBe('not-run');
    expect(never.tests[0].testRefs).toEqual(['tests/never.test.ts']);

    const ran = report.requirements.find((r) => r.reqUid === 'REQ-ran')!;
    expect(ran.passed).toBe(true);

    // Die Luecke ist eine Zahl, keine Fussnote.
    expect(report.summary.withVerifyTrace).toBe(2);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.neverRun).toBe(1);
  });

  it('ueberschreibt bei einem zweiten Lauf statt zu stapeln', async () => {
    await tools.graph_test_ingest.handler({ report: VITEST_JSON, consumerId: 'runner' });
    // CR-SM-231b: das Ergebnis steht am EINTRAG, nicht am Knoten — bei n Laeufen koennte ein
    // Knoten-Attribut nicht sagen, welcher gemeint ist.
    const ran = harness.getGraph().nodes.find((n) => n.uid === 'TEST-ran')!;
    const refs = ran.attributes?.testRefs as Array<{ file: string; result?: string; ranAt?: string }>;
    expect(refs.find((r) => r.file === 'tests/ran.test.ts')?.result).toBe('passed');
    expect(refs.find((r) => r.file === 'tests/ran.test.ts')?.ranAt).toBeDefined();

    const res = await tools.graph_test_ingest.handler({
      results: [{ file: 'tests/ran.test.ts', result: 'failed' }],
      consumerId: 'runner',
    });

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    const after = harness.getGraph().nodes.find((n) => n.uid === 'TEST-ran')!;
    const afterRefs = after.attributes?.testRefs as Array<{ file: string; result?: string }>;
    // Ueberschreiben, nicht stapeln: derselbe Eintrag traegt jetzt das neue Ergebnis.
    expect(afterRefs).toHaveLength(1);
    expect(afterRefs[0].result).toBe('failed');
    const report = await tools.graph_test_report.handler({});
    expect(report.requirements.find((r) => r.reqUid === 'REQ-ran')!.passed).toBe(false);
  });

  it('dryRun liefert den Plan, ohne zu schreiben', async () => {
    const res = await tools.graph_test_ingest.handler({ report: VITEST_JSON, dryRun: true, consumerId: 'runner' });

    expect(res.applied).toBe(0);
    expect(res.assignments).toHaveLength(1);
    expect(res.unresolved).toHaveLength(1);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'TEST-ran')?.attributes?.testResult).toBeUndefined();
  });

  it('VCRM: ein REQ mit verify-Kante, aber ohne Lauf, traegt kein bestanden-Haekchen', async () => {
    await tools.graph_test_ingest.handler({ report: VITEST_JSON, consumerId: 'runner' });
    const md = renderTestMatrix(harness.getGraph(), 'testreport');

    // Zwei Spalten, zwei Aussagen — vorher stand hier EIN Haekchen fuer beides.
    expect(md).toContain('| REQ | verify-Kante | Lauf-Ergebnis | verifying TEST(s) |');
    const neverRow = md.split('\n').find((l) => l.includes('`REQ-never`'))!;
    expect(neverRow).toContain('nie gelaufen');
    expect(neverRow).not.toContain('✓ passed');
    const ranRow = md.split('\n').find((l) => l.includes('`REQ-ran`'))!;
    expect(ranRow).toContain('✓ passed');
    expect(md).toMatch(/Belegt: 1\/2 REQ bestanden/);
  });
});

describe('parseVitestJson: kein Aufrunden nach gruen (CR-GC-327)', () => {
  it('bildet passed/failed direkt ab und eine reine Skip-Datei auf skipped', () => {
    const raw = JSON.stringify({
      testResults: [
        { name: 'a.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] },
        { name: 'b.test.ts', status: 'failed', assertionResults: [{ status: 'failed' }] },
        { name: 'c.test.ts', status: 'skipped', assertionResults: [{ status: 'skipped' }] },
      ],
    });
    expect(parseVitestJson(raw)).toEqual([
      { file: 'a.test.ts', result: 'passed' },
      { file: 'b.test.ts', result: 'failed' },
      { file: 'c.test.ts', result: 'skipped' },
    ]);
  });

  it('macht aus einem unbekannten Status `pending`, nie `passed`', () => {
    const raw = JSON.stringify({ testResults: [{ name: 'x.test.ts', status: 'weird', assertionResults: [] }] });
    expect(parseVitestJson(raw)[0].result).toBe('pending');
  });

  it('weist ein Dokument ohne testResults zurueck statt es leer durchzuwinken', () => {
    expect(() => parseVitestJson('{"foo":1}')).toThrow(/testResults/);
    expect(() => parseVitestJson('not json')).toThrow(/valid JSON/);
  });
});

describe('verificationReport: Kante ist nicht Nachweis (CR-GC-327)', () => {
  it('zaehlt einen REQ ohne verify-Kante weder als verifiziert noch als bestanden', () => {
    const report = verificationReport({
      nodes: [{ uid: 'REQ-lonely', type: 'REQ', name: 'Lonely', description: '', attributes: {} }],
      edges: [],
    });
    const req = report.requirements[0];
    expect(req.hasVerifyTrace).toBe(false);
    expect(req.passed).toBe(false);
    expect(report.summary).toMatchObject({ requirements: 1, withVerifyTrace: 0, passed: 0, neverRun: 0 });
  });
});
