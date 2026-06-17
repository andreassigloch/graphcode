/**
 * TEST-impact-subgraph — graph_impact returns ONLY the affected subgraph (REQ-query-precision / R6 / R12).
 *
 * Seeds the real graphcode.graph.json (196 nodes, 352 edges) into a disk Kuzu harness.
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
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
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
    // Use real repo root so seedFromJson() finds docs/graph/graphcode.graph.json
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage);
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

    // The full graph has 196 nodes; a depth-1 subgraph of MOD-harness must be smaller
    expect(nodeCount).toBeLessThan(fullNodeCount);
    // Edge count must also be less than the full 352
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
    // And must be a subset of the full 196 nodes
    expect(total).toBeLessThan(196);
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
