/**
 * TEST-graph-realize (CR-GC-216) — the flat realize affordance over the gate.
 *
 * graph_realize binds a FUNC's realRef (and optionally a TEST's testRef) in one
 * flat call, through harness.mutate() (gate-only, no parallel write path), and
 * returns the missingRefs delta so the realization is confirmed. Real disk Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

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

// A realized FUNC with no realRef (R-20) and a realized TEST with no testRef (R-19) — both warnings,
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
    expect(out.missingRefsBefore).toContain('FN-x'); // R-20 was firing
    expect(out.missingRefsAfter).not.toContain('FN-x');
    expect(out.resolved).toContain('FN-x');

    // The realRef is actually on the node, set through the gate (not a side store).
    const fn = harness.getGraph().nodes.find((n) => n.uid === 'FN-x')!;
    expect(fn.attributes.realRef).toEqual({ file: 'src/x.ts', symbol: 'doX' });
  });

  it('optionally binds a TEST testRef (R-19) in the same call', async () => {
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
    expect(test.attributes.testRef).toEqual({ file: 'tests/x.test.ts', tool: 'vitest' });
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
    expect(out.missingRefsBefore).toContain('SCHEMA-x'); // R-26 was firing
    expect(out.missingRefsAfter).not.toContain('SCHEMA-x');
    expect(out.resolved).toContain('SCHEMA-x');
    const sc = harness.getGraph().nodes.find((n) => n.uid === 'SCHEMA-x')!;
    expect(sc.attributes.realRef).toEqual({ file: 'src/se/ontology.ts', symbol: 'EventSchema' });
  });

  it('graph_realize with neither funcUid nor schemaUid → rejected by schema', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_realize.handler({ file: 'src/x.ts', symbol: 'doX' } as never)).rejects.toThrow();
  });
});
