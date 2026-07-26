/**
 * TEST-occ (CR-GC-233) — Optimistic Concurrency Control at the tool layer.
 *
 * Enterprise pattern (DynamoDB conditional writes / ES if_seq_no): a write carries
 * the graphVersion its author READ (`baseVersion`); a stale base is REJECTED with
 * the delta (the applied audit entries since), never merged. Without baseVersion
 * the write proceeds with a warning (soft migration).
 *
 * Real disk Kuzu in mkdtemp, durable FileOperationsLog beside the store, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { MutateResultSchema } from '@sigloch/contracts/harness';
import type { HarnessConfig, MutateCommand, MutateResult, RuleViolation } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'occ-ws', systemId: 'occ-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** A self-verified REQ batch — always legal through the gate. */
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-occ-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-occ-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-occ-${suffix}`, targetId: `REQ-occ-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

type WriteResult = MutateResult & {
  graphVersion: number;
  occWarning?: string;
};

describe('TEST-occ (CR-GC-233): graphVersion on reads, baseVersion check on writes', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-occ-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reads carry graphVersion; a write with the CURRENT baseVersion applies and increments it', async () => {
    const read0 = (await tools.graph_elements.handler({ limit: 100, format: 'json' })) as { graphVersion: number };
    expect(read0.graphVersion).toBe(0);

    const w1 = (await tools.graph_mutate.handler({
      commands: validSet('a'),
      consumerId: 'agent-1',
      baseVersion: read0.graphVersion,
    })) as WriteResult;
    expect(w1.success).toBe(true);
    expect(w1.graphVersion).toBe(1);
    expect(w1.occWarning).toBeUndefined(); // baseVersion given — no warning

    // Every read tool reports the NEW version.
    const els = (await tools.graph_elements.handler({ limit: 100, format: 'json' })) as { graphVersion: number };
    const node = (await tools.graph_get_node.handler({ uid: 'REQ-occ-a' })) as { graphVersion: number; node: unknown };
    const edges = (await tools.graph_get_edges.handler({ direction: 'both', format: 'json' })) as { graphVersion: number };
    const impact = (await tools.graph_impact.handler({ id: 'REQ-occ-a', depth: 1 })) as { graphVersion: number };
    const ctx = (await tools.graph_context.handler({ id: 'REQ-occ-a', depth: 1 })) as { graphVersion: number };
    const readiness = (await tools.graph_readiness.handler({ detail: false })) as { graphVersion: number };
    for (const r of [els, node, edges, impact, ctx, readiness]) expect(r.graphVersion).toBe(1);
    expect(node.node).not.toBeNull();
  });

  it('a STALE baseVersion is rejected (tier block) with the delta of applied batches since', async () => {
    // Writer A reads at version 0 …
    const base = 0;
    // … then B and C land two batches (versions 1 + 2).
    await tools.graph_mutate.handler({ commands: validSet('b'), consumerId: 'agent-b', baseVersion: 0 });
    await tools.graph_mutate.handler({ commands: validSet('c'), consumerId: 'agent-c', baseVersion: 1 });

    // A's write on the stale base is REJECTED — nothing applied, nothing persisted.
    const stale = (await tools.graph_mutate.handler({
      commands: validSet('a'),
      consumerId: 'agent-a',
      baseVersion: base,
    })) as WriteResult;
    expect(stale.success).toBe(false);
    expect(stale.tier).toBe('block');
    expect(stale.mutations).toBe(0);
    expect((stale.violations as RuleViolation[]).some((v) => v.ruleId === 'OCC' && v.severity === 'error')).toBe(true);

    // The stale response is CONTRACTS-conformant (CR-GC-243): parses against MutateResultSchema.
    expect(MutateResultSchema.safeParse(stale).success).toBe(true);
    expect(stale.stale).toBe(true);

    // staleDelta: BOTH intermediate applied batches, with the uids they touched (what changed, not just "stale").
    expect(stale.staleDelta?.sinceVersion).toBe(0);
    expect(stale.staleDelta?.currentVersion).toBe(2);
    expect(stale.staleDelta?.entries.map((e) => e.graphVersion)).toEqual([1, 2]);
    expect(stale.staleDelta?.entries.every((e) => e.changedUids.length >= 1)).toBe(true);
    expect(stale.staleDelta?.changedUids).toContain('REQ-occ-b');
    expect(stale.staleDelta?.changedUids).toContain('REQ-occ-c');

    // Rejected: not persisted, version unmoved.
    const gone = (await tools.graph_get_node.handler({ uid: 'REQ-occ-a' })) as { node: unknown; graphVersion: number };
    expect(gone.node).toBeNull();
    expect(gone.graphVersion).toBe(2);

    // Retry loop: re-read → current version → the SAME batch now applies.
    const retry = (await tools.graph_mutate.handler({
      commands: validSet('a'),
      consumerId: 'agent-a',
      baseVersion: gone.graphVersion,
    })) as WriteResult;
    expect(retry.success).toBe(true);
    expect(retry.graphVersion).toBe(3);
  });

  it('without baseVersion: no block, but an explicit OCC warning (soft migration)', async () => {
    const w = (await tools.graph_mutate.handler({ commands: validSet('w'), consumerId: 'agent-w' })) as WriteResult;
    expect(w.success).toBe(true);
    expect(w.occWarning).toMatch(/baseVersion/);
  });

  it('a gate-REJECTED write does not move the version (applied batches only)', async () => {
    await tools.graph_mutate.handler({ commands: validSet('x'), consumerId: 'agent-x', baseVersion: 0 });
    const rejected = (await tools.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'REQ-occ-orphan', type: 'REQ', name: 'o', description: '', attributes: {} } }],
      consumerId: 'agent-x',
      baseVersion: 1,
    })) as WriteResult; // fresh base, but R-01 blocks it at the gate
    expect(rejected.success).toBe(false);
    expect(rejected.graphVersion).toBe(1); // unchanged

    const read = (await tools.graph_elements.handler({ limit: 1, format: 'json' })) as { graphVersion: number };
    expect(read.graphVersion).toBe(1);
  });

  it('graph_realize honours baseVersion identically (stale → reject + delta, fresh → applies)', async () => {
    await tools.graph_mutate.handler({
      commands: [
        ...validSet('r'),
        { op: 'add-node', node: { uid: 'FN-occ', type: 'FUNC', name: 'f', description: '', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'FN-occ', targetId: 'REQ-occ-r', edgeType: 'satisfy', attributes: {} } },
      ],
      consumerId: 'agent-r',
      baseVersion: 0,
    });
    await tools.graph_mutate.handler({ commands: validSet('r2'), consumerId: 'agent-r2', baseVersion: 1 });

    const stale = (await tools.graph_realize.handler({
      funcUid: 'FN-occ',
      file: 'src/f.ts',
      symbol: 'f',
      consumerId: 'agent-r',
      baseVersion: 1, // stale: r2 landed at version 2
    })) as WriteResult & { resolved: string[] };
    expect(stale.success).toBe(false);
    expect(stale.staleDelta?.entries).toHaveLength(1);
    expect(stale.resolved).toEqual([]);

    const fresh = (await tools.graph_realize.handler({
      funcUid: 'FN-occ',
      file: 'src/f.ts',
      symbol: 'f',
      consumerId: 'agent-r',
      baseVersion: 2,
    })) as WriteResult & { resolved: string[] };
    expect(fresh.success).toBe(true);
    expect(fresh.graphVersion).toBe(3);
    expect(fresh.resolved).toContain('FN-occ');
  });

  it('the version survives a process restart (reconstructed from the durable log)', async () => {
    await tools.graph_mutate.handler({ commands: validSet('s'), consumerId: 'session-1', baseVersion: 0 });
    await harness.close();

    // "Next session": new harness + registry over the SAME store + log.
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    const read = (await tools.graph_elements.handler({ limit: 1, format: 'json' })) as { graphVersion: number };
    expect(read.graphVersion).toBe(1); // resumed, not reset

    // OCC still bites across the restart: version-0 base is stale now.
    const stale = (await tools.graph_mutate.handler({
      commands: validSet('s2'),
      consumerId: 'session-2',
      baseVersion: 0,
    })) as WriteResult;
    expect(stale.success).toBe(false);
    expect(stale.staleDelta?.entries).toHaveLength(1);
  });
});
