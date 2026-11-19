/**
 * TEST-test-von-hand (CR-GC-964, CR-GC-961 F3d) — ein Test, den ein Mensch durchfuehrt.
 *
 * Seine Datei ist eine Testbeschreibung (`tests/manuell/*.md`), gebunden mit Werkzeug `manuell`.
 * Die Auswahl gibt sie nie an vitest, sondern nennt sie „von Hand faellig". Das Ergebnis kommt ueber
 * `graph_test_ingest` mit dem Protokoll als `evidence`; aendert sich das gepruefte SCHEMA, nimmt ein
 * Ingest mit `changeSet` das Ergebnis zurueck.
 *
 * Reales Disk-Kuzu und echte Dateien im tmp-Repo, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { readTestRefs } from '@sigloch/contracts/se';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type ToolRegistry } from '../src/surface/mcp-tools.js';
import { testFilesOf } from '../src/projections/test-selection-audit.js';

const node = (uid: string, type: string, attributes: Record<string, unknown> = {}): MutateCommand => ({
  op: 'add-node',
  node: { uid, type, name: uid, description: `${uid}.`, attributes },
});
const edge = (sourceId: string, edgeType: string, targetId: string): MutateCommand => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

const HAND = 'tests/manuell/hebel.md';
const PROTOKOLL = 'tests/manuell/protokolle/2026-11-19-hebel.md';

// Ein physischer Vertrag (Vertragsdatei) mit Test von Hand, daneben ein Code-Test am selben REQ.
const SEED: MutateCommand[] = [
  node('SYS-h', 'SYS'),
  node('REQ-h', 'REQ', { kinds: ['functional'] }),
  node('FUNC-h', 'FUNC'),
  node('FLOW-h', 'FLOW', { sync: 'sync' }),
  node('SCHEMA-hebel', 'SCHEMA', { realRef: { file: 'docs/vertrag/hebel.md' } }),
  node('TEST-hebel', 'TEST'),
  node('TEST-code', 'TEST', { testRefs: [{ file: 'tests/code.test.ts', tool: 'vitest' }] }),
  edge('SYS-h', 'compose', 'REQ-h'),
  edge('FUNC-h', 'satisfy', 'REQ-h'),
  edge('FUNC-h', 'io', 'FLOW-h'),
  edge('FLOW-h', 'relation', 'SCHEMA-hebel'),
  edge('TEST-hebel', 'verify', 'SCHEMA-hebel'),
  edge('TEST-code', 'verify', 'REQ-h'),
];

describe('TEST-test-von-hand: Testbeschreibung von Hand (CR-GC-964)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ToolRegistry;
  const refs = (uid: string) => {
    const r = readTestRefs(harness.getGraph().nodes.find((n) => n.uid === uid)!.attributes);
    return r.state === 'bound' ? r.value : [];
  };

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-hand-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    mkdirSync(join(repoRoot, 'tests/manuell/protokolle'), { recursive: true });
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'hand-ws', systemId: 'hand' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') }));
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
    // Kopf der Testbeschreibung: die TEST-uid in der Ueberschrift.
    writeFileSync(
      join(repoRoot, HAND),
      '# Hebeltest (TEST-hebel)\n\nKunde betaetigt den Hebel; bestanden, wenn die Weiche in 2 s die Endlage meldet.\n',
    );
    writeFileSync(join(repoRoot, PROTOKOLL), '# Protokoll Hebeltest\n\nPruefer: Rolle Inbetriebnahme. Messwert: 1,4 s.\n');
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('bindet die Testbeschreibung ueber die Ueberschrift und schreibt Ergebnis und Protokoll', async () => {
    const res = await tools.graph_test_ingest.handler({
      results: [{ file: HAND, result: 'passed', tool: 'manuell', evidence: PROTOKOLL }],
      consumerId: 'pruefer',
    });
    expect(res.success).toBe(true);
    expect(res.unresolved).toEqual([]);
    const r = refs('TEST-hebel');
    expect(r.map((x) => [x.file, x.tool, x.result, x.evidence])).toEqual([[HAND, 'manuell', 'passed', PROTOKOLL]]);
    expect(r[0]?.ranAt).toBeTruthy();

    // Ein neuer Lauf ohne Protokoll laesst das alte nicht stehen: es belegt das neue Ergebnis nicht.
    await tools.graph_test_ingest.handler({ results: [{ file: HAND, result: 'failed', tool: 'manuell' }], consumerId: 'pruefer' });
    expect(refs('TEST-hebel').map((x) => [x.result, x.evidence])).toEqual([['failed', undefined]]);
  });

  it('graph_tests gibt die Testbeschreibung nicht an vitest, sondern nennt sie von Hand faellig', async () => {
    await tools.graph_test_ingest.handler({ results: [{ file: HAND, result: 'passed', tool: 'manuell' }], consumerId: 'pruefer' });
    const sel = await tools.graph_tests.handler({ changeSet: ['FUNC-h'], depth: 1 });
    expect(sel.command).toBe('vitest run tests/code.test.ts');
    expect(sel.coverage.files).toEqual(['tests/code.test.ts']);
    expect(sel.manuell).toEqual([{ id: 'TEST-hebel', name: 'TEST-hebel', file: HAND }]);
    // Die Code-Spur: dieselbe Trennung.
    expect(testFilesOf(harness.getGraph(), ['TEST-hebel', 'TEST-code'])).toEqual({
      files: ['tests/code.test.ts'],
      unresolved: [],
      manuell: ['TEST-hebel'],
    });
  });

  it('nimmt das Ergebnis zurueck, wenn sich das gepruefte SCHEMA aendert (CR-GC-961 F3.2)', async () => {
    await tools.graph_test_ingest.handler({
      results: [{ file: HAND, result: 'passed', tool: 'manuell', evidence: PROTOKOLL }],
      consumerId: 'pruefer',
    });
    const res = await tools.graph_test_ingest.handler({ changeSet: ['SCHEMA-hebel'], consumerId: 'aenderung' });
    expect(res.withdrawn).toEqual([{ testUid: 'TEST-hebel', file: HAND }]);
    expect(refs('TEST-hebel').map((x) => [x.result, x.evidence, x.ranAt])).toEqual([[undefined, undefined, undefined]]);
  });
});
