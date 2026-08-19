/**
 * TEST-graph-time-travel (CR-GC-217) — each commit carries a graph snapshot that
 * FITS the code, and any prior snapshot is recoverable.
 *
 * Proves the two halves of Approach A on a real disk Kuzu store (no mocks):
 *   1. Freshness signal: a gate mutate() leaves the .graphcode/EXPORT_PENDING drift
 *      marker (the single-writer-safe signal the pre-commit hook blocks on), and
 *      graph_export clears it once the committed snapshot is re-materialized.
 *   2. Recall: overwriting the committed snapshot with an OLDER commit's bytes and
 *      running graph_reseed restores exactly that state (proving `git checkout <sha>`
 *      + graph_reseed = recall), and clears the marker.
 *
 * Fully isolated: a temp repoRoot holds both the Kuzu store (.graphcode/kuzu), the
 * marker, and the committed snapshot (docs/graph/graphcode.graph.json) — so the real
 * repo is never touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { isExportPending, EXPORT_PENDING_REL } from '../src/export-marker.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const SNAPSHOT_REL = 'docs/graph/graphcode.graph.json';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'tt-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** A minimal, gate-legal commit: a REQ + the TEST that verifies it (no R-01 error). */
function reqWithTest(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-${suffix}`, type: 'REQ', name: `Req ${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-${suffix}`, type: 'TEST', name: `Test ${suffix}`, description: '', attributes: { concept: true } } },
    { op: 'add-edge', edge: { sourceId: `TEST-${suffix}`, targetId: `REQ-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

/**
 * Seed snapshot S0: one already-verified REQ so the import is spec-green, anchored
 * on its own SYS. The anchor is explicit (CR-GC-302) because the importer would
 * otherwise supply one — and this test recalls EXACT snapshot states, so a node the
 * fixture does not name would make the recall assertions measure the importer
 * instead of the time-travel.
 */
const S0 = {
  elements: [
    { id: 'SYS-tt', type: 'SYS', name: 'tt', description: 'Time-travel-Fixture.' },
    { id: 'REQ-a', type: 'REQ', name: 'Req a', description: '' },
    { id: 'TEST-a', type: 'TEST', name: 'Test a', description: '', concept: true },
  ],
  traces: [
    { source: 'TEST-a', target: 'REQ-a', type: 'verify' },
    { source: 'SYS-tt', target: 'REQ-a', type: 'compose' },
  ],
};

describe('TEST-graph-time-travel: per-commit snapshot freshness + recall (CR-GC-217)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tt-'));
    mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
    writeFileSync(join(tmp, SNAPSHOT_REL), JSON.stringify(S0, null, 2) + '\n');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.seedFromJson(); // store := S0
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('mutate sets the drift marker, export clears it, and reseeding an older snapshot recalls that exact state', async () => {
    const tools = bindToolsToHarness(harness);
    expect(isExportPending(tmp)).toBe(false); // clean after seed

    // (1) A gate mutation makes the live model lead the snapshot → marker set.
    expect((await harness.mutate(reqWithTest('b'))).success).toBe(true);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-b')).toBeDefined();
    expect(isExportPending(tmp)).toBe(true);

    // (2) graph_export re-materializes the snapshot AND clears the marker → this is
    // the "commit S1" state: a snapshot that fits the (mutated) model.
    await tools.graph_export.handler({});
    expect(isExportPending(tmp)).toBe(false);
    const s1Bytes = readFileSync(join(tmp, SNAPSHOT_REL), 'utf8');
    expect(s1Bytes).toContain('REQ-b'); // snapshot captured the mutation

    // (3) More work moves the live model to S2 (marker set again).
    expect((await harness.mutate(reqWithTest('c'))).success).toBe(true);
    expect(isExportPending(tmp)).toBe(true);

    // (4) RECALL: a `git checkout <older-sha>` brings back S0's snapshot bytes. We
    // simulate that by restoring the committed file, then graph_reseed re-syncs.
    writeFileSync(join(tmp, SNAPSHOT_REL), JSON.stringify(S0, null, 2) + '\n');
    const res = await tools.graph_reseed.handler({});

    // The live store is now EXACTLY S0 — b and c are gone, a remains.
    expect(res.nodes).toBe(S0.elements.length);
    expect(res.edges).toBe(S0.traces.length);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-a')).toBeDefined();
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-b')).toBeUndefined();
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-c')).toBeUndefined();
    // Recall left a clean working state (no phantom export-pending).
    expect(isExportPending(tmp)).toBe(false);

    // Store-level proof: the DISK store was cleared + re-imported, not just the cache.
    const reloaded = await harness.loadGraph();
    expect(reloaded.nodes.length).toBe(S0.elements.length);
    expect(reloaded.nodes.find((n) => n.uid === 'REQ-b')).toBeUndefined();
    expect(EXPORT_PENDING_REL).toBe('.graphcode/EXPORT_PENDING'); // marker contract pinned
  });
});
