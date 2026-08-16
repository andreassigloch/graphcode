/**
 * TEST-rule-calibration (CR-GC-347) — `audit_stats` aggregates per rule, consumer and model.
 *
 * The table four CRs were built on — CR-GC-284 ("R-01 dominated the rejections of every
 * model: Haiku 26/29, Opus 17/18, devstral 10/23"), CR-GC-286, CR-GC-290, CR-GC-292 — was
 * produced by hand with `jq` every single time, because no tool could answer it. An agent
 * that only has MCP tools could not ask the question at all (UC-loop-closure).
 *
 * The real-trail case compares against the `jq` LINE, computed here over the same data, not
 * against numbers written into the test: numbers copied from one measurement drift the
 * moment the trail grows, and a test that has to be re-copied is a test nobody trusts.
 *
 * Real disk Kuzu in mkdtemp for the tool path, the repo's own trail for the equivalence.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR, AUDIT_FILE } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsWithContext, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { ToolContext } from '../src/tool-context.js';
import { aggregateAuditEntries, type AuditStats } from '../src/tools/audit.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, 'kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'stats-ws', systemId: 'stats-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** A REQ without its verifying TEST — R-01 rejects it. */
function lonelyReq(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-lonely-${suffix}`, type: 'REQ', name: `l-${suffix}`, description: '', attributes: {} } },
  ];
}

/** A self-verified REQ batch — always legal through the gate. */
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-ok-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-ok-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-ok-${suffix}`, targetId: `REQ-ok-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

describe('TEST-rule-calibration (CR-GC-347): which rule blocks whom, how often', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;
  let ctx: ToolContext;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-stats-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    ({ registry: tools, ctx } = bindToolsWithContext(harness));
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('separates blocked RECORDS from violation OCCURRENCES', () => {
    // Twenty violations of one rule inside ONE rejected batch are ONE blockade by that rule
    // and twenty occurrences. Collapsing them into a single number is the mistake this
    // split exists to prevent — it would read as twenty independent blockades.
    const record = {
      id: 'a',
      timestamp: '2026-08-16T00:00:00.000Z',
      consumerId: 'c1',
      result: 'rejected',
      violations: Array.from({ length: 20 }, (_, i) => ({
        ruleId: 'R-29',
        severity: 'error',
        elementId: `X-${i}`,
      })),
    };

    const stats = aggregateAuditEntries([record], 7);
    const r29 = stats.byRule.find((r) => r.ruleId === 'R-29')!;
    expect(r29.blocked).toBe(1);
    expect(r29.occurrences).toBe(20);
    expect(r29.bySeverity).toEqual({ error: 20, warning: 0, info: 0 });
    expect(stats.totals.rejected).toBe(1);
    expect(stats.graphVersion).toBe(7);
  });

  it('counts a rule as blocking only where it actually gated', () => {
    const entries = [
      // Rejected, but R-20 fired as a WARNING — it did not block anything.
      {
        id: 'a',
        timestamp: '2026-08-16T00:00:01.000Z',
        consumerId: 'c1',
        result: 'rejected',
        violations: [
          { ruleId: 'R-01', severity: 'error', elementId: 'REQ-x' },
          { ruleId: 'R-20', severity: 'warning', elementId: 'FUNC-y' },
        ],
      },
      // APPLIED with an error-severity finding: the record went through, so nothing blocked.
      {
        id: 'b',
        timestamp: '2026-08-16T00:00:02.000Z',
        consumerId: 'c1',
        result: 'applied',
        violations: [{ ruleId: 'R-01', severity: 'error', elementId: 'REQ-z' }],
      },
    ];

    const stats = aggregateAuditEntries(entries, 1);
    const r01 = stats.byRule.find((r) => r.ruleId === 'R-01')!;
    const r20 = stats.byRule.find((r) => r.ruleId === 'R-20')!;
    expect(r01.blocked).toBe(1); // only the rejected record
    expect(r01.occurrences).toBe(2);
    expect(r20.blocked).toBe(0); // a warning never blocks
    expect(r20.occurrences).toBe(1);
  });

  it('reports passed/passRate as NULL when not recorded — never as zero', () => {
    // 80 of this repo's 128 records predate CR-GC-314 and carry no rulesPassed. Reading that
    // as "passed 0 times" would invent a rule that never lets anything through; the same
    // absence asymmetry REQ-A05 fixed at the recording end has to hold at the reading end.
    const noPassInfo = [
      { id: 'a', timestamp: '2026-08-16T00:00:00.000Z', consumerId: 'c', result: 'rejected', violations: [{ ruleId: 'R-08', severity: 'error' }] },
    ];
    const r08 = aggregateAuditEntries(noPassInfo, 1).byRule.find((r) => r.ruleId === 'R-08')!;
    expect(r08.passed).toBeNull();
    expect(r08.passRate).toBeNull();
    expect(r08.blocked).toBe(1); // the negative half is still known

    // A rate needs a COMPLETE population: one record with rulesPassed and one without means
    // the denominator is unknown, so the rate stays null even though `passed` is countable.
    const mixed = [
      { id: 'a', timestamp: '2026-08-16T00:00:00.000Z', consumerId: 'c', result: 'applied', rulesPassed: ['R-08'] },
      { id: 'b', timestamp: '2026-08-16T00:00:01.000Z', consumerId: 'c', result: 'applied' },
    ];
    const partial = aggregateAuditEntries(mixed, 1).byRule.find((r) => r.ruleId === 'R-08')!;
    expect(partial.passed).toBe(1);
    expect(partial.passRate).toBeNull();

    // Complete population ⇒ a real rate.
    const complete = [
      { id: 'a', timestamp: '2026-08-16T00:00:00.000Z', consumerId: 'c', result: 'applied', rulesPassed: ['R-08'] },
      { id: 'b', timestamp: '2026-08-16T00:00:01.000Z', consumerId: 'c', result: 'applied', rulesPassed: ['R-08'] },
    ];
    const full = aggregateAuditEntries(complete, 1).byRule.find((r) => r.ruleId === 'R-08')!;
    expect(full.passed).toBe(2);
    expect(full.passRate).toBe(1);
  });

  it('returns null for topBlockingRule on a tie — no invented winner', () => {
    const entries = [
      { id: 'a', timestamp: '2026-08-16T00:00:00.000Z', consumerId: 'c', result: 'rejected', violations: [{ ruleId: 'R-01', severity: 'error' }] },
      { id: 'b', timestamp: '2026-08-16T00:00:01.000Z', consumerId: 'c', result: 'rejected', violations: [{ ruleId: 'R-08', severity: 'error' }] },
    ];
    expect(aggregateAuditEntries(entries, 1).byConsumer[0].topBlockingRule).toBeNull();

    // One more R-01 breaks the tie.
    entries.push({ id: 'c', timestamp: '2026-08-16T00:00:02.000Z', consumerId: 'c', result: 'rejected', violations: [{ ruleId: 'R-01', severity: 'error' }] });
    expect(aggregateAuditEntries(entries, 1).byConsumer[0].topBlockingRule).toBe('R-01');
  });

  it('breaks down by MODEL — the dimension CR-GC-284 needed and could not read', () => {
    const entries = [
      { id: 'a', timestamp: '2026-08-16T00:00:00.000Z', consumerId: 'mcp-client', model: 'haiku-4.5', result: 'rejected', violations: [{ ruleId: 'R-01', severity: 'error' }] },
      { id: 'b', timestamp: '2026-08-16T00:00:01.000Z', consumerId: 'mcp-client', model: 'haiku-4.5', result: 'applied' },
      { id: 'c', timestamp: '2026-08-16T00:00:02.000Z', consumerId: 'mcp-client', model: 'devstral-small:24b', result: 'rejected', violations: [{ ruleId: 'R-08', severity: 'error' }] },
      // No model: a pre-CR-GC-354 record. It must NOT appear as an "unknown" model, which
      // would read as a real actor with a real block rate.
      { id: 'd', timestamp: '2026-08-16T00:00:03.000Z', consumerId: 'mcp-client', result: 'applied' },
    ];

    const { byModel, byConsumer } = aggregateAuditEntries(entries, 1);
    expect(byModel.map((m) => m.model).sort()).toEqual(['devstral-small:24b', 'haiku-4.5']);
    const haiku = byModel.find((m) => m.model === 'haiku-4.5')!;
    expect(haiku).toMatchObject({ applied: 1, rejected: 1, topBlockingRule: 'R-01' });
    // The model-less record still counts for its consumer — absence of one field is not
    // absence of the record.
    expect(byConsumer[0]).toMatchObject({ consumerId: 'mcp-client', applied: 2, rejected: 2 });
  });

  it('filters by since and consumerId; an empty match is empty, not an error', async () => {
    ctx.setOrigin({ model: 'test-model' });
    await tools['graph_mutate'].handler({ commands: validSet('a'), consumerId: 'alice' });
    await tools['graph_mutate'].handler({ commands: lonelyReq('b'), consumerId: 'bob' });

    const all = (await tools['audit_stats'].handler({})) as AuditStats;
    expect(all.window.entries).toBe(2);
    expect(all.totals).toMatchObject({ applied: 1, rejected: 1 });
    expect(all.byConsumer.map((c) => c.consumerId).sort()).toEqual(['alice', 'bob']);
    // The gate rejection is real, not staged: R-01 blocked bob's lone REQ.
    expect(all.byRule.some((r) => r.blocked > 0)).toBe(true);
    expect(all.byModel).toEqual([
      { model: 'test-model', applied: 1, rejected: 1, topBlockingRule: expect.any(String) },
    ]);

    const onlyBob = (await tools['audit_stats'].handler({ consumerId: 'bob' })) as AuditStats;
    expect(onlyBob.window.entries).toBe(1);
    expect(onlyBob.totals).toMatchObject({ applied: 0, rejected: 1 });

    const nobody = (await tools['audit_stats'].handler({ consumerId: 'nobody' })) as AuditStats;
    expect(nobody.window).toMatchObject({ since: null, until: null, entries: 0 });
    expect(nobody.byRule).toEqual([]);
    expect(nobody.byConsumer).toEqual([]);
  });

  it('matches the jq line on the REAL repo trail — computed, never copied', () => {
    const trail = join(process.cwd(), AUDIT_FILE);
    if (!existsSync(trail)) return; // a fresh clone has no trail; nothing to compare against

    const records = readFileSync(trail, 'utf8')
      .trim()
      .split('\n')
      .flatMap((l) => {
        try {
          const r = JSON.parse(l) as Record<string, unknown>;
          return r.id !== undefined ? [r] : []; // skip CHECKPOINT lines
        } catch {
          return [];
        }
      });
    expect(records.length).toBeGreaterThan(0);

    // The exact query from CR-GC-347 §1:
    //   jq -r 'select(.result=="rejected") | .violations[]? | select(.severity=="error")
    //          | .ruleId' audit.jsonl | sort | uniq -c
    const jq = new Map<string, number>();
    for (const r of records) {
      if (r.result !== 'rejected') continue;
      for (const v of (r.violations as Array<Record<string, unknown>> | undefined) ?? []) {
        if (v.severity !== 'error') continue;
        const id = String(v.ruleId);
        jq.set(id, (jq.get(id) ?? 0) + 1);
      }
    }

    const stats = aggregateAuditEntries(records, 0);
    for (const [ruleId, occurrences] of jq) {
      const s = stats.byRule.find((r) => r.ruleId === ruleId);
      expect(s, `rule ${ruleId} missing from byRule`).toBeDefined();
      // The jq line counts VIOLATIONS in rejected records; `bySeverity.error` is the
      // superset (it also counts errors in applied records), so blocked ≤ jq ≤ error.
      expect(s!.bySeverity.error).toBeGreaterThanOrEqual(occurrences);
      expect(s!.blocked).toBeGreaterThan(0);
      expect(s!.blocked).toBeLessThanOrEqual(occurrences);
    }

    // Every rule the jq line finds is a rule the tool reports as blocking, and vice versa —
    // the equivalence has to hold in BOTH directions or the tool is quietly dropping rules.
    const toolBlockers = stats.byRule.filter((r) => r.blocked > 0).map((r) => r.ruleId).sort();
    expect(toolBlockers).toEqual([...jq.keys()].sort());

    // Window bounds are the real timestamps, not defaults.
    expect(stats.window.entries).toBe(records.length);
    expect(stats.window.since).toBe(records.map((r) => String(r.timestamp)).sort()[0]);
  });
});
