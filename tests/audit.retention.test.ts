/**
 * TEST-audit-retention (CR-GC-349) — what survives compaction, and what a query can SEE.
 *
 * Two separate promises, and CR-GC-346 F4 conflated them:
 *   - RETENTION: `compact()` archives by rename and deletes nothing. F4 called it
 *     "Beweisvernichtung"; it is not, and the first case here pins that so the wrong premise
 *     cannot come back.
 *   - HORIZON: a plain `query()` reads only the ACTIVE log. After the first compaction an
 *     aggregation would therefore report a near-empty trail while the full evidence sits
 *     untouched beside it — not a missing measurement but a WRONG one shaped like a result.
 *     That is the defect this CR fixes.
 *
 * Real FileOperationsLog on disk in mkdtemp, tiny maxBytes so compaction actually fires. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileOperationsLog } from '@sigloch/graph-api-core';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { aggregateAuditEntries } from '../src/tools/audit.js';

function entry(i: number, result: AuditEntry['result']): AuditEntry {
  return {
    id: `audit-${i}`,
    timestamp: `2026-08-16T00:00:${String(i).padStart(2, '0')}.000Z`,
    consumerId: i % 2 ? 'alice' : 'bob',
    consumerType: 'agent',
    operation: 'mutate',
    result,
    // Enough prose to cross the tiny compaction threshold within a handful of records.
    violations: [
      {
        ruleId: i % 3 === 0 ? 'R-01' : 'R-08',
        severity: 'error',
        elementId: `REQ-${i}`,
        message: 'Eine ausfuehrliche Begruendung, damit der Log schnell genug waechst. '.repeat(4),
      } as AuditEntry['violations'] extends Array<infer V> ? V : never,
    ],
    graphVersion: i,
  };
}

describe('TEST-audit-retention (CR-GC-349): nothing is deleted, and nothing is hidden', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'graphcode-retention-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Write n entries through a log whose threshold forces at least one rotation. */
  async function seed(n: number, maxBytes = 2048): Promise<FileOperationsLog> {
    let log = new FileOperationsLog(dir, { maxBytes });
    for (let i = 0; i < n; i++) {
      await log.record(entry(i, i % 4 === 0 ? 'rejected' : 'applied'));
      // Compaction is checked at BIND time (session start), never mid-write — so rotating
      // means re-binding, exactly as a new session would.
      log = new FileOperationsLog(dir, { maxBytes });
    }
    return log;
  }

  it('compaction ARCHIVES — it does not delete (the premise CR-GC-346 F4 got wrong)', async () => {
    const log = await seed(30);
    const archives = log.archives();

    expect(archives.length, 'compaction never fired — raise the record count').toBeGreaterThan(0);
    for (const a of archives) {
      expect(existsSync(a)).toBe(true);
      expect(readFileSync(a, 'utf8').trim().length).toBeGreaterThan(0);
    }
    // The version anchor is what makes rotation safe for OCC and replay.
    expect(log.latestVersion()).toBe(29);
    expect(log.baseVersion()).toBeGreaterThan(0);
  });

  it('a plain query goes BLIND after compaction — the horizon spans the archives', async () => {
    const log = await seed(30);

    const live = await log.query({});
    const full = await log.query({ includeArchived: true });

    // The active log holds only what was written since the last rotation.
    expect(live.length).toBeLessThan(30);
    expect(full).toHaveLength(30);
    // Log ORDER, oldest first — archives before the active segment, not appended after it.
    expect(full.map((e) => e.id)).toEqual(Array.from({ length: 30 }, (_, i) => `audit-${i}`));
    // Default stays live-only on purpose: OCC calls query({}) on the write path.
    expect(live.length).toBe((await log.query({})).length);
  });

  it('the aggregation over a compacted log equals the aggregation over the same data', async () => {
    const log = await seed(30);

    const raw = Array.from({ length: 30 }, (_, i) => entry(i, i % 4 === 0 ? 'rejected' : 'applied'));
    const expected = aggregateAuditEntries(raw as never, 0);
    const actual = aggregateAuditEntries((await log.query({ includeArchived: true })) as never, 0);
    expect(actual.byRule).toEqual(expected.byRule);
    expect(actual.byConsumer).toEqual(expected.byConsumer);
    expect(actual.totals).toEqual(expected.totals);

    // Without the horizon it silently reports a fraction — the wrong-measurement case.
    const blind = aggregateAuditEntries((await log.query({})) as never, 0);
    expect(blind.window.entries).toBeLessThan(actual.window.entries);
  });

  it('filters apply across the whole horizon, not just the active segment', async () => {
    const log = await seed(30);

    const alice = await log.query({ consumerId: 'alice', includeArchived: true });
    expect(alice).toHaveLength(15); // every odd index
    expect(alice.every((e) => e.consumerId === 'alice')).toBe(true);

    // `since` reaches back into an archived segment.
    const since = await log.query({ since: '2026-08-16T00:00:05.000Z', includeArchived: true });
    expect(since).toHaveLength(25);
    expect(since[0].id).toBe('audit-5');
  });

  it('an unreadable archive costs the segment, never the answer', async () => {
    const log = await seed(30);
    const [first] = log.archives();
    // Torn tail, hand-mangled file, half-synced backup — all the same shape.
    writeFileSync(first, '{"id":"audit-0","timesta', 'utf8');

    const full = await log.query({ includeArchived: true });
    // The query SUCCEEDS: losing part of the horizon is a gap, losing the answer is a defect.
    expect(full.length).toBeGreaterThan(0);
    expect(full.every((e) => typeof e.id === 'string')).toBe(true);
  });

  it('reports the horizon as a number — 0 archives is a measurement, not a gap', async () => {
    // Never compacted: the zero says "nothing was rotated away", which is TRUE and therefore
    // not null. Contrast `passed`/`passRate` in audit_stats, where null means not recorded.
    const fresh = new FileOperationsLog(dir, { maxBytes: 10 * 1024 * 1024 });
    await fresh.record(entry(0, 'applied'));
    expect(fresh.archives()).toEqual([]);
    expect(fresh.baseVersion()).toBe(0);

    const rotated = await seed(30);
    expect(rotated.archives().length).toBeGreaterThan(0);
    expect(rotated.baseVersion()).toBeGreaterThan(0);
  });
});
