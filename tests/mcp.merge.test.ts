/**
 * TEST-merge (CR-GC-234) — replay-based branch reintegration (semantic rebase).
 *
 * Real two-store integration, no mocks: a TARGET repo and a BRANCH repo (its own
 * disk Kuzu + durable audit log, as a gcw worktree would have), both seeded with
 * the same base through their gates. The branch's command log is then merged into
 * the target via graph_merge — replay through the existing Apply-Gate.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { exportGraphJson } from '../src/exporter.js';
import type { MergeReport } from '../src/merge.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'merge-ws', systemId: 'merge-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** A self-verified REQ batch (legal through any gate). */
function reqSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-${suffix}`, targetId: `REQ-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

/** The shared base both sides fork from: a verified REQ + a FUNC satisfying it. */
const BASE: MutateCommand[] = [
  ...reqSet('base'),
  { op: 'add-node', node: { uid: 'FN-base', type: 'FUNC', name: 'f', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'FN-base', targetId: 'REQ-base', edgeType: 'satisfy', attributes: {} } },
];

type MergeResult = MergeReport & { graphVersion: number };

describe('TEST-merge (CR-GC-234): graph_merge replays a branch log through the gate', () => {
  let tmpA: string; // target
  let tmpB: string; // branch (a gcw worktree's store, conceptually)
  let target: GraphCodeHarness;
  let branch: GraphCodeHarness;
  let targetTools: MCPToolRegistry;
  let branchTools: MCPToolRegistry;
  let branchLog: string;

  beforeEach(async () => {
    tmpA = mkdtempSync(join(tmpdir(), 'graphcode-merge-target-'));
    tmpB = mkdtempSync(join(tmpdir(), 'graphcode-merge-branch-'));
    target = makeHarness(tmpA);
    branch = makeHarness(tmpB);
    await target.initialize();
    await branch.initialize();
    targetTools = bindToolsToHarness(target);
    branchTools = bindToolsToHarness(branch);
    branchLog = join(tmpB, '.graphcode', 'audit.jsonl');

    // Shared history: the same base batch lands on both sides (version 1 each).
    await targetTools.graph_mutate.handler({ commands: BASE, consumerId: 'shared', baseVersion: 0 });
    await branchTools.graph_mutate.handler({ commands: BASE, consumerId: 'shared', baseVersion: 0 });
  });

  afterEach(async () => {
    await target.close();
    await branch.close();
    rmSync(tmpA, { recursive: true, force: true });
    rmSync(tmpB, { recursive: true, force: true });
  });

  it('disjoint changes: replay applies BOTH branch batches onto a moved target — 0 conflicted', async () => {
    // Branch diverges with two batches (versions 2 + 3 on the branch)…
    await branchTools.graph_mutate.handler({ commands: reqSet('b1'), consumerId: 'agent-b', baseVersion: 1 });
    await branchTools.graph_mutate.handler({ commands: reqSet('b2'), consumerId: 'agent-b', baseVersion: 2 });
    // …while the target moved independently (disjoint element).
    await targetTools.graph_mutate.handler({ commands: reqSet('a1'), consumerId: 'agent-a', baseVersion: 1 });

    const report = (await targetTools.graph_merge.handler({
      log: branchLog,
      sinceVersion: 1, // the shared base version = fork point
      dryRun: false,
      consumerId: 'graph-merge',
    })) as MergeResult;

    expect(report.replayed).toBe(2);
    expect(report.applied).toHaveLength(2);
    expect(report.conflicted).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);

    // Both branch elements are now in the target store; the merge writes counted as versions.
    const b1 = (await targetTools.graph_get_node.handler({ uid: 'REQ-b1' })) as { node: { uid: string } | null };
    const b2 = (await targetTools.graph_get_node.handler({ uid: 'REQ-b2' })) as { node: { uid: string } | null };
    expect(b1.node?.uid).toBe('REQ-b1');
    expect(b2.node?.uid).toBe('REQ-b2');
    expect(report.graphVersion).toBe(4); // base(1) + a1(2) + two merged batches(3,4)
  });

  it('overlapping conflict (branch updates what the target deleted): batch skipped + reported, never resurrected', async () => {
    // Branch updates FN-base (a realize) …
    await branchTools.graph_mutate.handler({
      commands: [
        { op: 'update-node', node: { uid: 'FN-base', type: 'FUNC', attributes: { realRef: { file: 'src/f.ts', symbol: 'f' } } } },
      ],
      consumerId: 'agent-b',
      baseVersion: 1,
    });
    // … while the target DELETED it.
    const del = (await targetTools.graph_mutate.handler({
      commands: [{ op: 'delete-node', uid: 'FN-base' }],
      consumerId: 'agent-a',
      baseVersion: 1,
    })) as { success: boolean };
    expect(del.success).toBe(true);

    const report = (await targetTools.graph_merge.handler({
      log: branchLog,
      sinceVersion: 1,
      dryRun: false,
      consumerId: 'graph-merge',
    })) as MergeResult;

    expect(report.applied).toHaveLength(0);
    expect(report.conflicted).toHaveLength(1);
    // The report names the violation AND the element — machine-resolvable.
    expect(report.conflicted[0].violations.some((v) => v.elementId === 'FN-base' && v.severity === 'error')).toBe(true);
    expect(report.conflicted[0].violations[0].fixHint).toBeTruthy();

    // Nothing was silently applied: the node stays deleted.
    const gone = (await targetTools.graph_get_node.handler({ uid: 'FN-base' })) as { node: unknown };
    expect(gone.node).toBeNull();
  });

  it('dryRun: full preview report, but graph + target log stay byte-identical', async () => {
    await branchTools.graph_mutate.handler({ commands: reqSet('b1'), consumerId: 'agent-b', baseVersion: 1 });

    const targetLog = join(tmpA, '.graphcode', 'audit.jsonl');
    const graphBefore = exportGraphJson(target.getGraph());
    const logBefore = readFileSync(targetLog, 'utf8');

    const report = (await targetTools.graph_merge.handler({
      log: branchLog,
      sinceVersion: 1,
      dryRun: true,
      consumerId: 'graph-merge',
    })) as MergeResult;

    expect(report.dryRun).toBe(true);
    expect(report.applied).toHaveLength(1); // the preview verdict
    expect(exportGraphJson(target.getGraph())).toBe(graphBefore); // in-memory restored
    expect(readFileSync(targetLog, 'utf8')).toBe(logBefore); // log untouched
    // Store untouched: the previewed element does not exist after the dry run.
    const gone = (await targetTools.graph_get_node.handler({ uid: 'REQ-b1' })) as { node: unknown };
    expect(gone.node).toBeNull();
  });

  it('idempotent batches are skipped as already-contained (re-merge is safe)', async () => {
    await branchTools.graph_mutate.handler({ commands: reqSet('b1'), consumerId: 'agent-b', baseVersion: 1 });

    const first = (await targetTools.graph_merge.handler({
      log: branchLog,
      sinceVersion: 1,
      dryRun: false,
      consumerId: 'graph-merge',
    })) as MergeResult;
    expect(first.applied).toHaveLength(1);

    const again = (await targetTools.graph_merge.handler({
      log: branchLog,
      sinceVersion: 1,
      dryRun: false,
      consumerId: 'graph-merge',
    })) as MergeResult;
    expect(again.applied).toHaveLength(0);
    expect(again.conflicted).toHaveLength(0);
    expect(again.skipped).toHaveLength(1);
    expect(again.skipped[0].reason).toBe('already-contained');
  });
});
