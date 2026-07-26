/**
 * TEST-graph-context — graph_context returns the UPSTREAM spec-closure ("definition of done")
 * for one realization node (CR-GC-213), and ONLY that.
 *
 * Discriminator vs graph_impact: impact = DOWNSTREAM dependents (incoming); context = UPSTREAM
 * spec (the REQ/UC a FUNC satisfies, the TEST verifying those REQ, the FLOW it exchanges, the MOD
 * it is allocated to, the SCHEMA of those FLOW). The MS that *composes* the FUNC is a downstream
 * container — graph_impact would include it, graph_context must EXCLUDE it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-graph-context: upstream spec-closure (CR-GC-213)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  // FN-1 satisfies REQ-1 + UC-1; TST-1 verifies REQ-1; FLOW-1 feeds FN-1 (io) and is typed by
  // SCH-1 (relation); FN-1 is allocated to MOD-1; MS-1 COMPOSES FN-1 (downstream container).
  // REQ-2 / TST-2 are an unrelated component.
  const fixture = {
    elements: [
      { id: 'FN-1', type: 'FUNC', name: 'Slice', description: 'recall-first slicer (no realRef yet)' },
      { id: 'REQ-1', type: 'REQ', name: 'Recall-first', description: 'core recall >=0.85' },
      { id: 'UC-1', type: 'UC', name: 'Structure a doc', description: 'realizes F1' },
      { id: 'TST-1', type: 'TEST', name: 'Recall benchmark', description: 'PASS iff recall >=0.85' },
      { id: 'FLOW-1', type: 'FLOW', name: 'DocSet', description: 'primary doc + attachments' },
      { id: 'SCH-1', type: 'SCHEMA', name: 'SlicerOutput', description: 'candidate graph shape' },
      { id: 'MOD-1', type: 'MOD', name: 'slicer', description: 'host module' },
      { id: 'MS-1', type: 'MS', name: 'Milestone Slicer', description: 'downstream container' },
      { id: 'REQ-2', type: 'REQ', name: 'Unrelated', description: 'other component' },
      { id: 'TST-2', type: 'TEST', name: 'Unrelated test', description: 'verifies REQ-2' },
    ],
    traces: [
      { source: 'FN-1', target: 'REQ-1', type: 'satisfy' },
      { source: 'FN-1', target: 'UC-1', type: 'satisfy' },
      { source: 'TST-1', target: 'REQ-1', type: 'verify' }, // back-edge → included
      { source: 'FLOW-1', target: 'FN-1', type: 'io' }, // flow feeds FN-1 → included
      { source: 'FLOW-1', target: 'SCH-1', type: 'relation' }, // data contract → included
      { source: 'FN-1', target: 'MOD-1', type: 'allocate' }, // host module → included
      { source: 'MS-1', target: 'FN-1', type: 'compose' }, // DOWNSTREAM container → EXCLUDED
      { source: 'TST-2', target: 'REQ-2', type: 'verify' }, // unrelated → excluded
    ],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-context-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  function uidsFromFormatE(formatE: string): Set<string> {
    const all = fixture.elements.map((e) => e.id);
    return new Set(all.filter((uid) => formatE.includes(uid)));
  }

  it('returns EXACTLY the upstream spec-closure of FN-1', async () => {
    const registry = bindToolsToHarness(harness);
    const { rootId, formatE } = await registry['graph_context'].handler({ id: 'FN-1', depth: 1 });

    expect(rootId).toBe('FN-1');
    expect(uidsFromFormatE(formatE)).toEqual(
      new Set(['FN-1', 'REQ-1', 'UC-1', 'TST-1', 'FLOW-1', 'SCH-1', 'MOD-1']),
    );
  });

  it('EXCLUDES the downstream container MS-1 (the impact/context discriminator)', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_context'].handler({ id: 'FN-1', depth: 1 });
    expect(uidsFromFormatE(formatE).has('MS-1')).toBe(false);
    // sanity: graph_impact (downstream) DOES surface MS-1 as a dependent
    const impact = await registry['graph_impact'].handler({ id: 'FN-1', depth: 1 });
    expect(impact.formatE).toContain('MS-1');
  });

  it('EXCLUDES the unrelated component (REQ-2, TST-2)', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_context'].handler({ id: 'FN-1', depth: 1 });
    const present = uidsFromFormatE(formatE);
    expect(present.has('REQ-2')).toBe(false);
    expect(present.has('TST-2')).toBe(false);
  });

  it('flags FN-1 in missingRefs — FUNC has no realRef/referenceImpl to implement from', async () => {
    const registry = bindToolsToHarness(harness);
    const { missingRefs } = await registry['graph_context'].handler({ id: 'FN-1', depth: 1 });
    expect(missingRefs).toContain('FN-1');
  });

  it('serialises as valid non-empty Format-E containing the root', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_context'].handler({ id: 'FN-1', depth: 1 });
    expect(formatE).toContain('FN-1');
    expect(formatE).toContain('## Nodes');
  });

  it('throws on an unknown node id (no silent empty slice)', async () => {
    const registry = bindToolsToHarness(harness);
    await expect(registry['graph_context'].handler({ id: 'NOPE', depth: 1 })).rejects.toThrow(/not found/);
  });
});

describe('TEST-graph-context: missingRefs is empty when the FUNC carries a realRef', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  const fixture = {
    elements: [
      {
        id: 'FN-R',
        type: 'FUNC',
        name: 'Realized func',
        description: 'has realRef',
        realRef: { file: 'src/slice.ts', symbol: 'slice' },
      },
      { id: 'REQ-R', type: 'REQ', name: 'Req R', description: 'satisfied by FN-R' },
    ],
    traces: [{ source: 'FN-R', target: 'REQ-R', type: 'satisfy' }],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-context-ref-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('missingRefs is empty', async () => {
    const registry = bindToolsToHarness(harness);
    const { missingRefs } = await registry['graph_context'].handler({ id: 'FN-R', depth: 1 });
    expect(missingRefs).toEqual([]);
  });
});
