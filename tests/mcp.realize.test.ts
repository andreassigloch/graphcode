/**
 * TEST-graph-realize (CR-GC-216) — the flat realize affordance over the gate.
 *
 * graph_realize binds a FUNC's realRef (and optionally a TEST's testRefs entry) in one
 * flat call, through harness.mutate() (gate-only, no parallel write path), and
 * returns the missingRefs delta so the realization is confirmed. Real disk Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

/** Die Zeilen des Audit-Trails — CR-GC-611 prueft daran, dass ein Batch EIN Eintrag ist. */
function readAuditLines(repoRoot: string): string[] {
  const p = join(repoRoot, '.graphcode', 'audit.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [];
}

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'realize-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A realized FUNC with no realRef (R-20) and a realized TEST with no testRefs (R-19) — both warnings,
// so the gate accepts the seed; graph_realize then clears them.
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'FN-x', type: 'FUNC', name: 'Do x', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-x', type: 'TEST', name: 'x test', description: '', attributes: {} } },
];

describe('TEST-graph-realize (CR-GC-216): flat realize affordance through the gate', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-realize-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.mutate(SPEC);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('sets realRef through the gate; the FUNC leaves missingRefs; the delta is returned', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_realize.handler({ funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX' });

    expect(out.success).toBe(true);
    expect(out.resolved).toContain('FN-x'); // R-20 war offen und ist geschlossen
    expect(out.introduced).toEqual([]);
    expect(out.openRefs).toBe(1); // TEST-x (R-19) ist noch offen — die Zahl, nicht die Liste
    // CR-GC-611: die beiden vollen Listen sind weg (87 % der Antwort, bei jeder Bindung dieselben).
    expect(out).not.toHaveProperty('missingRefsBefore');
    expect(out).not.toHaveProperty('missingRefsAfter');

    // The realRef is actually on the node, set through the gate (not a side store).
    const fn = harness.getGraph().nodes.find((n) => n.uid === 'FN-x')!;
    expect(fn.attributes.realRef).toEqual({ file: 'src/x.ts', symbol: 'doX' });
  });

  it('optionally adds a TEST testRefs entry (R-19) in the same call', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_realize.handler({
      funcUid: 'FN-x',
      file: 'src/x.ts',
      symbol: 'doX',
      testUid: 'TEST-x',
      testFile: 'tests/x.test.ts',
    });

    expect(out.resolved).toEqual(expect.arrayContaining(['FN-x', 'TEST-x']));
    const test = harness.getGraph().nodes.find((n) => n.uid === 'TEST-x')!;
    expect(test.attributes.testRefs).toEqual([{ file: 'tests/x.test.ts', tool: 'vitest' }]);
  });

  it('unknown funcUid → a clear error (no silent no-op)', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_realize.handler({ funcUid: 'FN-nope', file: 'src/x.ts', symbol: 'doX' })).rejects.toThrow(
      /unknown funcUid/i,
    );
  });

  // CR-211: realRef binding through the same affordance.
  it('binds a SCHEMA realRef; the SCHEMA leaves missingRefs (R-26); delta returned', async () => {
    const tools = bindToolsToHarness(harness);
    // A bare SCHEMA has no realRef → R-26 warning (accepted seed, then cleared).
    await harness.mutate([
      { op: 'add-node', node: { uid: 'SCHEMA-x', type: 'SCHEMA', name: 'evt', description: '', attributes: {} } },
    ]);
    const out = await tools.graph_realize.handler({
      schemaUid: 'SCHEMA-x',
      schemaFile: 'src/se/ontology.ts',
      schemaSymbol: 'EventSchema',
    });

    expect(out.success).toBe(true);
    expect(out.resolved).toContain('SCHEMA-x'); // R-26 war offen und ist geschlossen
    const sc = harness.getGraph().nodes.find((n) => n.uid === 'SCHEMA-x')!;
    expect(sc.attributes.realRef).toEqual({ file: 'src/se/ontology.ts', symbol: 'EventSchema' });
  });

  it('graph_realize with neither funcUid nor schemaUid → rejected by schema', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_realize.handler({ file: 'src/x.ts', symbol: 'doX' } as never)).rejects.toThrow();
  });
});

// CR-GC-611: 15 Aufrufe im Code-Test waren 15-mal dieselbe FUNC-Bindung mit je einer Testzeile mehr.
describe('TEST-graph-realize-batch (CR-GC-611): mehrere Bindungen in EINEM Gate-Batch', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-realize-batch-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.mutate([
      ...SPEC,
      { op: 'add-node', node: { uid: 'FN-y', type: 'FUNC', name: 'Do y', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'SCHEMA-x', type: 'SCHEMA', name: 'evt', description: '', attributes: {} } },
    ]);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('bindet FUNC, FUNC, SCHEMA und TEST in einem Aufruf — ein Audit-Eintrag, alle Verweise geschlossen', async () => {
    const tools = bindToolsToHarness(harness);
    const vorher = readAuditLines(repoRoot);
    const out = await tools.graph_realize.handler({
      bindings: [
        { funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX' },
        { funcUid: 'FN-y', file: 'src/y.ts', symbol: 'doY' },
        { schemaUid: 'SCHEMA-x', schemaFile: 'src/schema.ts', schemaSymbol: 'EventSchema' },
        { testUid: 'TEST-x', testFile: 'tests/x.test.ts', funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX' },
      ],
    });

    expect(out.success).toBe(true);
    expect(out.resolved).toEqual(expect.arrayContaining(['FN-x', 'FN-y', 'SCHEMA-x', 'TEST-x']));
    expect(out.openRefs).toBe(0);
    expect(readAuditLines(repoRoot).length - vorher.length).toBe(1); // EIN Batch, nicht vier
  });

  it('haengt mehrere Testfaelle derselben TEST-Datei an, ohne dass der letzte die vorigen frisst', async () => {
    const tools = bindToolsToHarness(harness);
    await tools.graph_realize.handler({
      bindings: [
        { funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX', testUid: 'TEST-x', testFile: 'tests/x.test.ts', testCase: 'erster Fall' },
        { funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX', testUid: 'TEST-x', testFile: 'tests/x.test.ts', testCase: 'zweiter Fall' },
      ],
    });

    const test = harness.getGraph().nodes.find((n) => n.uid === 'TEST-x')!;
    expect(test.attributes.testRefs).toEqual([
      { file: 'tests/x.test.ts', tool: 'vitest', case: 'erster Fall' },
      { file: 'tests/x.test.ts', tool: 'vitest', case: 'zweiter Fall' },
    ]);
  });

  it('ein unbekannter Knoten im Batch lehnt den GANZEN Batch ab — keine Teilanwendung', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(
      tools.graph_realize.handler({
        bindings: [
          { funcUid: 'FN-x', file: 'src/x.ts', symbol: 'doX' },
          { funcUid: 'FN-nope', file: 'src/nope.ts', symbol: 'nope' },
        ],
      }),
    ).rejects.toThrow(/bindings\[1\].*unknown funcUid/i);

    const fn = harness.getGraph().nodes.find((n) => n.uid === 'FN-x')!;
    expect(fn.attributes.realRef).toBeUndefined(); // FN-x blieb ungebunden
  });

  it('flache Felder UND bindings[] zugleich → vom Schema abgelehnt (ein Pfad, zwei Schreibweisen)', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(
      tools.graph_realize.handler({
        funcUid: 'FN-x',
        file: 'src/x.ts',
        symbol: 'doX',
        bindings: [{ funcUid: 'FN-y', file: 'src/y.ts', symbol: 'doY' }],
      } as never),
    ).rejects.toThrow();
  });
});
