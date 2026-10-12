/**
 * TEST-test-result-withdrawn-on-change (CR-GC-799) — ein Ergebnis gilt nicht über die Änderung hinaus.
 *
 * Der gemessene Zustand vor diesem CR (FMEA CR-GC-798, FM-11): fünf der sechs Tests, die
 * `graph_tests` für eine Änderung an `FUNC-test-ingest` auswählt, trugen am eigenen Modell
 * `passed` mit `ranAt` 2026-08-21 — sieben Wochen und mehrere Umbauten alt. `ranAt` las niemand,
 * und nichts nahm ein Ergebnis zurück. FM-03 hielt ein Risiko damit für verifiziert.
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
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'ruecknahme-ws', systemId: 'ruecknahme' },
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
 * FUNC-a erfüllt REQ-a, das TEST-a prüft; TEST-a prüft auch das Risiko REQ-risk (S 9, also
 * hohe Priorität nach FM-03). FUNC-b, REQ-b und TEST-b sind die Gegenprobe: von einer
 * Änderung an FUNC-a nicht betroffen.
 */
const SEED: MutateCommand[] = [
  node('SYS-t', 'SYS', 'Test system'),
  node('MOD-t', 'MOD', 'Test module'),
  node('FUNC-a', 'FUNC', 'Function a'),
  node('FUNC-b', 'FUNC', 'Function b'),
  node('REQ-a', 'REQ', 'Requirement a', { kinds: ['functional'] }),
  node('REQ-b', 'REQ', 'Requirement b', { kinds: ['functional'] }),
  node('REQ-risk', 'REQ', 'Risk on a', {
    kinds: ['non-functional'],
    role: 'risk',
    severity: 9,
    occurrence: 3,
    detection: 3,
  }),
  node('TEST-a', 'TEST', 'Test a', { testRefs: [{ file: 'tests/a.test.ts', tool: 'vitest' }] }),
  node('TEST-b', 'TEST', 'Test b', { testRefs: [{ file: 'tests/b.test.ts', tool: 'vitest' }] }),
  edge('SYS-t', 'compose', 'REQ-a'),
  edge('SYS-t', 'compose', 'REQ-b'),
  edge('SYS-t', 'compose', 'REQ-risk'),
  edge('FUNC-a', 'allocate', 'MOD-t'),
  edge('FUNC-b', 'allocate', 'MOD-t'),
  edge('FUNC-a', 'satisfy', 'REQ-a'),
  edge('FUNC-b', 'satisfy', 'REQ-b'),
  edge('MOD-t', 'satisfy', 'REQ-risk'),
  edge('TEST-a', 'verify', 'REQ-a'),
  edge('TEST-a', 'verify', 'REQ-risk'),
  edge('TEST-b', 'verify', 'REQ-b'),
];

const BEIDE_GRUEN = [
  { file: 'tests/a.test.ts', result: 'passed' as const },
  { file: 'tests/b.test.ts', result: 'passed' as const },
];

describe('TEST-test-result-withdrawn-on-change: Ruecknahme bei Aenderung (CR-GC-799)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  const refs = (uid: string): Array<Record<string, unknown>> =>
    harness.getGraph().nodes.find((n) => n.uid === uid)!.attributes!.testRefs as Array<Record<string, unknown>>;
  const fm03 = async (): Promise<string[]> => {
    const res = (await tools.rules_evaluate.handler({ detail: 'summary' })) as {
      violations: Array<{ ruleId: string; elementId: string }>;
    };
    return res.violations.filter((v) => v.ruleId === 'FM-03').map((v) => v.elementId);
  };

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-ruecknahme-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
    await tools.graph_test_ingest.handler({ results: BEIDE_GRUEN, consumerId: 'runner' });
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('nimmt das Ergebnis des betroffenen Tests zurueck, und FM-03 meldet das Risiko wieder', async () => {
    expect(refs('TEST-a')[0].result).toBe('passed');
    expect(await fm03()).not.toContain('REQ-risk');

    const res = await tools.graph_test_ingest.handler({ changeSet: ['FUNC-a'], consumerId: 'runner' });

    expect(res.success).toBe(true);
    expect(res.withdrawn).toEqual([{ testUid: 'TEST-a', file: 'tests/a.test.ts' }]);
    expect(refs('TEST-a')[0]).toEqual({ file: 'tests/a.test.ts', tool: 'vitest' });
    expect(await fm03()).toContain('REQ-risk');
  });

  it('laesst den nicht betroffenen Test unberuehrt (Gegenprobe)', async () => {
    await tools.graph_test_ingest.handler({ changeSet: ['FUNC-a'], consumerId: 'runner' });

    expect(refs('TEST-b')[0].result).toBe('passed');
    expect(typeof refs('TEST-b')[0].ranAt).toBe('string');
  });

  it('nimmt nicht zurueck, was derselbe Aufruf frisch liefert', async () => {
    const res = await tools.graph_test_ingest.handler({
      changeSet: ['FUNC-a'],
      results: [{ file: 'tests/a.test.ts', result: 'failed' }],
      consumerId: 'runner',
    });

    expect(res.withdrawn).toEqual([]);
    expect(res.assignments).toEqual([{ testUid: 'TEST-a', file: 'tests/a.test.ts', result: 'failed' }]);
    expect(refs('TEST-a')[0].result).toBe('failed');
  });

  it('ein TEST-Knoten im changeSet ist selbst betroffen (geaenderte Testdatei)', async () => {
    const res = await tools.graph_test_ingest.handler({ changeSet: ['TEST-b'], consumerId: 'runner' });

    expect(res.withdrawn).toEqual([{ testUid: 'TEST-b', file: 'tests/b.test.ts' }]);
    expect(refs('TEST-b')[0].result).toBeUndefined();
    expect(refs('TEST-a')[0].result).toBe('passed');
  });

  it('dryRun zeigt den Plan und schreibt nichts', async () => {
    const res = await tools.graph_test_ingest.handler({ changeSet: ['FUNC-a'], dryRun: true, consumerId: 'runner' });

    expect(res.applied).toBe(0);
    expect(res.withdrawn).toEqual([{ testUid: 'TEST-a', file: 'tests/a.test.ts' }]);
    expect(refs('TEST-a')[0].result).toBe('passed');
  });

  it('weist eine unbekannte uid im changeSet ab und nennt sie', async () => {
    await expect(
      tools.graph_test_ingest.handler({ changeSet: ['FUNC-a', 'FUNC-gibt-es-nicht'], consumerId: 'runner' }),
    ).rejects.toThrow(/FUNC-gibt-es-nicht/);
    expect(refs('TEST-a')[0].result).toBe('passed');
  });

  it('verlangt mindestens eine Eingabe und hoechstens eine Ergebnisquelle', () => {
    const schema = tools.graph_test_ingest.inputSchema;
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ report: '{}', results: [] }).success).toBe(false);
    expect(schema.safeParse({ changeSet: ['FUNC-a'] }).success).toBe(true);
    expect(schema.safeParse({ changeSet: ['FUNC-a'], results: [] }).success).toBe(true);
  });
});
