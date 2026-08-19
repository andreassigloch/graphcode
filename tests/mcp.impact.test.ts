/**
 * TEST-impact-subgraph — graph_impact returns ONLY the affected subgraph (REQ-query-precision / R6 / R12).
 *
 * Seeds the real graphcode.graph.json (full SSOT graph) into a disk Kuzu harness.
 * Calls graph_impact on a node that has known dependents (MOD-harness, which has multiple
 * outgoing edges in the graph). Asserts:
 *   (a) the returned slice contains the root node itself;
 *   (b) the slice is STRICTLY SMALLER than the full graph (no full dump);
 *   (c) graph_expand with depth+1 returns a larger (or equal) subgraph;
 *   (d) the slice serialises as valid Format-E text.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-impact-subgraph: graph_impact precision (R6/R12)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-impact-'));
    const kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    // Real repo root so seedFromJson() finds docs/graph/graphcode.graph.json;
    // lockDir = the temp store's dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) graph_impact returns a slice containing the root node', async () => {
    const registry = bindToolsToHarness(harness);
    const { rootId, nodeCount, formatE } = await registry['graph_impact'].handler({
      id: 'MOD-harness',
      depth: 1,
    });

    expect(rootId).toBe('MOD-harness');
    expect(nodeCount).toBeGreaterThanOrEqual(1);
    // Format-E serializes the root node uid somewhere in the output
    expect(formatE).toContain('MOD-harness');
  });

  it('(b) graph_impact slice is STRICTLY SMALLER than the full graph (no full dump)', async () => {
    const fullGraph = harness.getGraph();
    const fullNodeCount = fullGraph.nodes.length;

    const registry = bindToolsToHarness(harness);
    const { nodeCount, edgeCount } = await registry['graph_impact'].handler({
      id: 'MOD-harness',
      depth: 1,
    });

    // a depth-1 subgraph of MOD-harness must be smaller
    expect(nodeCount).toBeLessThan(fullNodeCount);
    // Edge count must also be less than the full graph
    expect(edgeCount).toBeLessThan(fullGraph.edges.length);
  });

  it('(c) graph_impact depth=2 returns >= nodes than depth=1', async () => {
    const registry = bindToolsToHarness(harness);
    const { nodeCount: nc1 } = await registry['graph_impact'].handler({ id: 'MOD-harness', depth: 1 });
    const { nodeCount: nc2 } = await registry['graph_impact'].handler({ id: 'MOD-harness', depth: 2 });

    // Deeper traversal must not shrink the subgraph
    expect(nc2).toBeGreaterThanOrEqual(nc1);
  });

  it('(d) Format-E slice is valid non-empty text', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_impact'].handler({ id: 'MOD-harness', depth: 1 });

    expect(typeof formatE).toBe('string');
    expect(formatE.length).toBeGreaterThan(0);
    // Must contain the standard Format-E node section header
    expect(formatE).toContain('## Nodes');
  });

  it('graph_expand deepens on-demand from a known node', async () => {
    const registry = bindToolsToHarness(harness);

    // Depth 1 expansion
    const { nodeCount: nc1 } = await registry['graph_expand'].handler({
      handle: 'MOD-harness',
      branch: 'all',
      depth: 1,
    });

    // Depth 2 expansion — must be >= depth 1
    const { nodeCount: nc2, formatE } = await registry['graph_expand'].handler({
      handle: 'MOD-harness',
      branch: 'all',
      depth: 2,
    });

    expect(nc2).toBeGreaterThanOrEqual(nc1);
    expect(formatE).toContain('MOD-harness');
  });

  it('graph_elements returns a filtered subset, not the full graph', async () => {
    const registry = bindToolsToHarness(harness);

    const { nodes, total } = await registry['graph_elements'].handler({
      type: 'REQ',
      limit: 100,
    });

    // Must return only REQ nodes
    expect(nodes.every((n: { type: string }) => n.type === 'REQ')).toBe(true);
    // And must be a subset of the full graph (count derived live, not hardcoded)
    expect(total).toBeLessThan(harness.getGraph().nodes.length);
    expect(total).toBeGreaterThan(0);
  });

  it('rules_evaluate returns an array of violations (read-only, no mutation)', async () => {
    const registry = bindToolsToHarness(harness);
    const before = harness.getGraph().nodes.length;

    const { violations } = await registry['rules_evaluate'].handler({});

    expect(Array.isArray(violations)).toBe(true);
    // Evaluate must not mutate the graph
    expect(harness.getGraph().nodes.length).toBe(before);
  });
});

/**
 * Direction-precision fixture (CR-GC-126): blast-radius = DEPENDENTS = INCOMING edges,
 * computed in Kuzu via `(m)-[*1..d]->(root)`. Seeds a tiny graph on disk Kuzu:
 *   TEST-A -verify->  REQ-A    (dependent of REQ-A, incoming)
 *   MOD-A  -satisfy-> REQ-A    (dependent of REQ-A, incoming)
 *   REQ-A  -compose-> REQ-DEP (pure OUTGOING dependency of REQ-A — NOT impacted)
 *   TEST-B -verify->  REQ-B    (unrelated component)
 * Asserts graph_impact(REQ-A) returns EXACTLY {REQ-A, TEST-A, MOD-A}, excluding the
 * outgoing dependency (REQ-DEP) and the unrelated component (REQ-B, TEST-B).
 */
describe('TEST-impact-subgraph: graph_impact direction = dependents/incoming (CR-GC-126)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  const fixture = {
    elements: [
      { id: 'REQ-A', type: 'REQ', name: 'Req A', description: 'root under test' },
      { id: 'TEST-A', type: 'TEST', name: 'Test A', description: 'verifies REQ-A' },
      { id: 'MOD-A', type: 'MOD', name: 'Mod A', description: 'satisfies REQ-A' },
      { id: 'REQ-DEP', type: 'REQ', name: 'Req Dep', description: 'pure outgoing dependency of REQ-A' },
      { id: 'REQ-B', type: 'REQ', name: 'Req B', description: 'unrelated component' },
      { id: 'TEST-B', type: 'TEST', name: 'Test B', description: 'verifies REQ-B' },
    ],
    traces: [
      { source: 'TEST-A', target: 'REQ-A', type: 'verify' }, // incoming dependent
      { source: 'MOD-A', target: 'REQ-A', type: 'satisfy' }, // incoming dependent
      { source: 'REQ-A', target: 'REQ-DEP', type: 'compose' }, // OUTGOING dependency (sub-requirement)
      { source: 'TEST-B', target: 'REQ-B', type: 'verify' }, // unrelated
    ],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-impact-dir-'));
    const kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    // Bootstrap import (not a gated mutate) — seeds the disk Kuzu store directly.
    await harness.importGraph(fixture);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  function uidsFromFormatE(formatE: string): Set<string> {
    // Format-E lists each node uid; recover the set by membership probing the fixture uids.
    const all = fixture.elements.map((e) => e.id);
    return new Set(all.filter((uid) => formatE.includes(uid)));
  }

  it('graph_impact(REQ-A) returns EXACTLY the dependent set {REQ-A, TEST-A, MOD-A} (incoming)', async () => {
    const registry = bindToolsToHarness(harness);
    const { rootId, nodeCount, formatE } = await registry['graph_impact'].handler({ id: 'REQ-A', depth: 1 });

    expect(rootId).toBe('REQ-A');
    const present = uidsFromFormatE(formatE);
    // Exact set + direction: root + its incoming dependents only.
    expect(present).toEqual(new Set(['REQ-A', 'TEST-A', 'MOD-A']));
    expect(nodeCount).toBe(3);
  });

  it('graph_impact(REQ-A) EXCLUDES the pure outgoing dependency (REQ-DEP)', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_impact'].handler({ id: 'REQ-A', depth: 1 });
    expect(uidsFromFormatE(formatE).has('REQ-DEP')).toBe(false);
  });

  it('graph_impact(REQ-A) EXCLUDES the unrelated component (REQ-B, TEST-B)', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_impact'].handler({ id: 'REQ-A', depth: 1 });
    const present = uidsFromFormatE(formatE);
    expect(present.has('REQ-B')).toBe(false);
    expect(present.has('TEST-B')).toBe(false);
  });

  it('graph_expand(REQ-A, branch=callers) = incoming dependents only (matches impact direction)', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_expand'].handler({ handle: 'REQ-A', branch: 'callers', depth: 1 });
    const present = uidsFromFormatE(formatE);
    expect(present).toEqual(new Set(['REQ-A', 'TEST-A', 'MOD-A']));
    expect(present.has('REQ-DEP')).toBe(false);
  });

  it('graph_expand(REQ-A, branch=all) includes BOTH dependents and the outgoing dependency', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_expand'].handler({ handle: 'REQ-A', branch: 'all', depth: 1 });
    const present = uidsFromFormatE(formatE);
    // both-direction: dependents (in) + dependency (out)
    expect(present.has('TEST-A')).toBe(true);
    expect(present.has('MOD-A')).toBe(true);
    expect(present.has('REQ-DEP')).toBe(true);
    // still excludes the unrelated component
    expect(present.has('REQ-B')).toBe(false);
  });
});
