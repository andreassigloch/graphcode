/**
 * TEST-reseed (CR-GC-203 item 4) — graph_reseed re-syncs the live store to the
 * committed SSOT JSON in-process, behind the single writer.
 *
 * Proves it DISCARDS an un-exported gate mutation and restores the committed
 * counts WITHOUT corruption — the failure mode of the old `rm .graphcode/kuzu`
 * dance was a store with 0 edges. The store-level check reloads from disk
 * (harness.loadGraph) to prove the DISK store was cleared+resynced, not just the
 * in-memory cache.
 *
 * Real disk Kuzu (temp store), repoRoot = real repo so the committed JSON is
 * found. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const PROBE: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-reseed-probe', type: 'REQ', name: 'Reseed probe', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reseed-probe', type: 'TEST', name: 'Reseed probe test', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reseed-probe', targetId: 'REQ-reseed-probe', edgeType: 'verify', attributes: {} } },
];

describe('TEST-reseed: graph_reseed re-syncs the store to the committed SSOT (CR-GC-203 item 4)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-reseed-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('discards an un-exported gate mutation and restores committed counts without corruption', async () => {
    const committedNodes = harness.getGraph().nodes.length;
    const committedEdges = harness.getGraph().edges.length;
    expect(committedNodes).toBeGreaterThan(0);
    expect(committedEdges).toBeGreaterThan(0);

    // A valid gate mutation (REQ + verifying TEST → no R-01) lands in the live store…
    expect((await harness.mutate(PROBE)).success).toBe(true);
    expect(harness.getGraph().nodes.length).toBe(committedNodes + 2);

    // …then graph_reseed clears + re-imports the committed SSOT.
    const tools = bindToolsToHarness(harness);
    const res = await tools.graph_reseed.handler({});

    expect(res.reseeded).toBe(true);
    expect(res.nodes).toBe(committedNodes);
    expect(res.edges).toBe(committedEdges);
    // In-memory restored, probe gone.
    expect(harness.getGraph().nodes.length).toBe(committedNodes);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-reseed-probe')).toBeUndefined();

    // Store-level proof: reload from the DISK store — the clear+reimport hit disk,
    // not just the in-memory cache, and the store is NOT corrupted (edges intact).
    const reloaded = await harness.loadGraph();
    expect(reloaded.nodes.length).toBe(committedNodes);
    expect(reloaded.edges.length).toBe(committedEdges);
    expect(reloaded.edges.length).toBeGreaterThan(0);
    expect(reloaded.nodes.find((n) => n.uid === 'REQ-reseed-probe')).toBeUndefined();
  });
});
