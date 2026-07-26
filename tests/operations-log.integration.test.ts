/**
 * Operations-log integration (CR-GC-232 → CR-207) — graphcode's consumption of the
 * durable log now lifted to the store module (@sigloch/graph-api-core). The
 * FileOperationsLog UNIT behaviour (restart survival, torn tail, compaction,
 * version anchor) is tested in graph-api-core; here we pin the graphcode-side
 * contract on real disk Kuzu: a new session resumes the version from the log
 * instead of resetting to 0, audit_trail reads across sessions, graph_realize is
 * audited (no bypass), and graphVersion counts APPLIED batches only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR, AUDIT_FILE } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'audit-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-a', type: 'SYS', name: 'A', description: '', attributes: {} } },
];

describe('operations-log integration (CR-207): registry uses the durable store log by default', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-audit-reg-'));
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  it('version + trail continue across sessions; graph_realize is audited (bypass closed)', async () => {
    // Session 1: one gated write via graph_mutate, one via graph_realize.
    const h1 = makeHarness(repoRoot);
    await h1.initialize();
    const t1 = bindToolsToHarness(h1);
    await t1.graph_mutate.handler({ commands: SPEC, consumerId: 'session-1' });
    await t1.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'FN-a', type: 'FUNC', name: 'f', description: '', attributes: {} } }],
      consumerId: 'session-1',
    });
    await t1.graph_realize.handler({ funcUid: 'FN-a', file: 'src/a.ts', symbol: 'a', consumerId: 'session-1' });
    const s1 = (await t1.audit_stats.handler({})) as { totalEntries: number; graphVersion: number };
    expect(s1.totalEntries).toBe(3); // realize IS in the log
    expect(s1.graphVersion).toBe(3);
    await h1.close();

    // Session 2 (same repoRoot): durable continuity — no reset to 0.
    const h2 = makeHarness(repoRoot);
    await h2.initialize();
    const t2 = bindToolsToHarness(h2);
    const s2 = (await t2.audit_stats.handler({})) as { totalEntries: number; graphVersion: number };
    expect(s2.totalEntries).toBe(3); // audit_trail reads across sessions
    expect(s2.graphVersion).toBe(3); // version resumed, not 0
    // A REQ is only valid with its verify-traced TEST (R-01) — an APPLIED batch,
    // because graphVersion counts applied batches only (CR-GC-233 OCC semantics).
    await t2.graph_mutate.handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-b', type: 'REQ', name: 'b', description: '', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-b', type: 'TEST', name: 'tb', description: '', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-b', targetId: 'REQ-b', edgeType: 'verify', attributes: {} } },
      ],
      consumerId: 'session-2',
    });
    const s3 = (await t2.audit_stats.handler({})) as { graphVersion: number };
    expect(s3.graphVersion).toBe(4); // monotonic across the restart
    // A REJECTED write is logged but does NOT move the version (state unchanged).
    await t2.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'REQ-orphan', type: 'REQ', name: 'o', description: '', attributes: {} } }],
      consumerId: 'session-2',
    });
    const s4 = (await t2.audit_stats.handler({})) as { totalEntries: number; rejected: number; graphVersion: number };
    expect(s4.rejected).toBe(1);
    expect(s4.graphVersion).toBe(4); // applied-only counter (CR-GC-233)
    // The durable file carries the command batches (replay source for CR-234).
    const raw = readFileSync(join(repoRoot, AUDIT_FILE), 'utf8').trim().split('\n');
    expect(raw).toHaveLength(5);
    expect(raw.every((l) => JSON.parse(l).commands?.length >= 1)).toBe(true);
    await h2.close();
  });
});
