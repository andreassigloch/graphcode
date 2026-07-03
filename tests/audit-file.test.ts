/**
 * TEST-audit-file (CR-GC-232) — the durable append-only command log.
 *
 * Unit: entries survive a "restart" (new FileAuditLog on the same root), carry the
 * MutateCommand batch, tolerate a torn tail, and compaction is version-safe by
 * construction (checkpoint anchor). Integration (real disk Kuzu): a new session's
 * registry resumes the version from the log instead of resetting to 0, audit_trail
 * reads across sessions, and graph_realize no longer bypasses the audit log.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, appendFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { FileAuditLog, AUDIT_FILE, AUDIT_BASENAME, type GraphcodeAuditEntry } from '../src/audit-file.js';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const entry = (n: number, over: Partial<GraphcodeAuditEntry> = {}): GraphcodeAuditEntry => ({
  id: `audit-${n}`,
  timestamp: new Date(2026, 0, n).toISOString(),
  consumerId: 'test',
  consumerType: 'agent',
  operation: 'mutate',
  result: 'applied',
  graphVersion: n,
  commands: [{ op: 'add-node', node: { uid: `REQ-${n}`, type: 'REQ', name: `r${n}`, attributes: {} } }],
  ...over,
});

describe('TEST-audit-file (CR-GC-232): durable append-only command log', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'graphcode-audit-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('entries (incl. commands) survive a restart — a NEW instance reads them', async () => {
    const a = new FileAuditLog(root);
    await a.record(entry(1));
    await a.record(entry(2));

    const b = new FileAuditLog(root); // "next session"
    const read = (await b.query({})) as GraphcodeAuditEntry[];
    expect(read).toHaveLength(2);
    expect(read[1].commands?.[0]).toMatchObject({ op: 'add-node' }); // replayable (CR-234)
    expect(b.latestVersion()).toBe(2);
  });

  it('mirrors InMemoryAuditLog query semantics (consumerId, since inclusive, limit = last N)', async () => {
    const log = new FileAuditLog(root);
    await log.record(entry(1));
    await log.record(entry(2, { consumerId: 'other' }));
    await log.record(entry(3));

    expect(await log.query({ consumerId: 'other' })).toHaveLength(1);
    expect(await log.query({ since: new Date(2026, 0, 2).toISOString() })).toHaveLength(2); // inclusive
    const limited = await log.query({ limit: 2 });
    expect(limited.map((e) => e.id)).toEqual(['audit-2', 'audit-3']); // last N
  });

  it('tolerates a torn tail (crash mid-append) — reads the intact entries, never throws', async () => {
    const log = new FileAuditLog(root);
    await log.record(entry(1));
    appendFileSync(join(root, AUDIT_BASENAME), '{"id":"audit-torn","times'); // crash artifact
    const again = new FileAuditLog(root);
    expect(await again.query({})).toHaveLength(1);
    expect(again.latestVersion()).toBe(1);
  });

  it('compaction archives + checkpoints; latestVersion identical before/after; writes continue counting', async () => {
    const log = new FileAuditLog(root);
    await log.record(entry(1));
    await log.record(entry(2));
    const before = log.latestVersion();

    const { archivedTo, checkpointVersion } = log.compact('test');
    expect(archivedTo && existsSync(archivedTo)).toBe(true);
    expect(checkpointVersion).toBe(before);
    expect(log.latestVersion()).toBe(before); // version-safe by construction
    expect(await log.query({})).toHaveLength(0); // entries archived, not lost (in the archive file)

    await log.record(entry(3, { graphVersion: before + 1 }));
    expect(log.latestVersion()).toBe(before + 1);
  });

  it('auto-compacts at the size threshold on bind (session start)', async () => {
    const log = new FileAuditLog(root, { maxBytes: 200 });
    await log.record(entry(1));
    await log.record(entry(2)); // > 200 bytes now
    const sizeBefore = statSync(join(root, AUDIT_BASENAME)).size;
    expect(sizeBefore).toBeGreaterThan(200);

    const next = new FileAuditLog(root, { maxBytes: 200 }); // next bind → auto-compaction
    expect(statSync(join(root, AUDIT_BASENAME)).size).toBeLessThan(sizeBefore);
    expect(next.latestVersion()).toBe(2); // checkpoint carried the version
  });
});

// ---------------------------------------------------------------------------

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

describe('TEST-audit-file (CR-GC-232): registry uses the durable log by default', () => {
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
    await t2.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'REQ-b', type: 'REQ', name: 'b', description: '', attributes: {} } }],
      consumerId: 'session-2',
    });
    const s3 = (await t2.audit_stats.handler({})) as { graphVersion: number };
    expect(s3.graphVersion).toBe(4); // monotonic across the restart
    // The durable file carries the command batches (replay source for CR-234).
    const raw = readFileSync(join(repoRoot, AUDIT_FILE), 'utf8').trim().split('\n');
    expect(raw).toHaveLength(4);
    expect(raw.every((l) => JSON.parse(l).commands?.length >= 1)).toBe(true);
    await h2.close();
  });
});
