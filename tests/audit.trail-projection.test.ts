/**
 * TEST-audit-trail-projection (CR-GC-319) — `audit_trail` hands out a lean projection.
 *
 * It used to return raw records. Measured on this repo's own trail, one default call
 * (`limit: 50`) was 163 KB ≈ 40k tokens, of which 129 KB (79 %) were the full mutate
 * batches. The agent asks the trail to learn WHAT HAPPENED; the one consumer that needs
 * the batches is the replay-merge, and it reads the JSONL file directly — never this tool.
 *
 * Same rule as CR-GC-314: writing is not delivering. The record on disk stays complete,
 * so the two assertions that matter are (a) the payload actually collapsed on a realistic
 * batch and (b) `includeCommands` still returns the batches byte-identically. A projection
 * that quietly lost data would pass a size budget just as well.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { projectAuditEntries, type AuditStats } from '../src/tools/audit.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/**
 * A realistic authoring batch: 30 REQs each with its verifying TEST — 90 commands, few
 * violations. That ratio is the point. A batch of lone REQs would trip R-01 thirty times
 * and let violations dominate, which is NOT what this repo's trail looks like (79 %
 * commands, 14 % violations) and would measure the wrong thing.
 */
const BULK = Array.from({ length: 30 }, (_, i) => [
  {
    op: 'add-node',
    node: {
      uid: `REQ-bulk-${i}`,
      type: 'REQ',
      name: `Anforderung ${i}`,
      description: `Das System muss Sache ${i} innerhalb von zwei Sekunden bestaetigen und protokollieren.`,
    },
  },
  {
    op: 'add-node',
    node: {
      uid: `TEST-bulk-${i}`,
      type: 'TEST',
      name: `Test ${i}`,
      description: `Prueft, dass Sache ${i} innerhalb von zwei Sekunden bestaetigt wird.`,
    },
  },
  { op: 'add-edge', edge: { sourceId: `TEST-bulk-${i}`, targetId: `REQ-bulk-${i}`, edgeType: 'verify' } },
]).flat();

const MIXED = [
  { op: 'add-node', node: { uid: 'MOD-a', type: 'MOD', name: 'a', description: 'Ein Modul.' } },
  { op: 'add-node', node: { uid: 'MOD-b', type: 'MOD', name: 'b', description: 'Noch ein Modul.' } },
  { op: 'delete-node', uid: 'MOD-b' },
];

type Entry = Record<string, unknown> & {
  commandCount?: number;
  opSummary?: string;
  commands?: unknown[];
  violations?: Array<Record<string, unknown>>;
};

const bytes = (o: unknown): number => Buffer.byteLength(JSON.stringify(o));

describe('TEST-audit-trail-projection (CR-GC-319)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-trail-projection-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [{ id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' }],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('carries the shape of a change without its content (REQ-T01)', async () => {
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't' });
    const [e] = (await tools.audit_trail.handler({})).entries as Entry[];

    for (const k of ['id', 'timestamp', 'consumerId', 'operation', 'result', 'graphVersion']) {
      expect(e, `field ${k}`).toHaveProperty(k);
    }
    expect(e.commandCount).toBe(3);
    expect(e.opSummary).toBe('+2 ~0 -1');
    expect(e).not.toHaveProperty('commands');
  });

  it('keeps violations but drops fixHint/context (REQ-T02)', async () => {
    // MOD-a has no allocated FUNC → R-23 fires and carries a fixHint + candidate context.
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't' });
    const [e] = (await tools.audit_trail.handler({})).entries as Entry[];

    expect(e.violations!.length).toBeGreaterThan(0);
    for (const v of e.violations!) {
      expect(v).toHaveProperty('ruleId');
      expect(v).toHaveProperty('severity');
      // `message` only where it EXPLAINS something (CR-GC-346 F3): a gating error carries
      // its text and its elementId, a non-gating finding carries a count instead. Repeating
      // identical prose per element is the volume that took the size claim red.
      if (v.severity === 'error') {
        expect(v).toHaveProperty('message');
        expect(v).toHaveProperty('elementId');
      } else {
        expect(v).toHaveProperty('count');
        expect(v).not.toHaveProperty('message');
      }
      // These are the bulk of the remaining bytes and live in rules_get_violations —
      // the tool whose job is repairing, not recounting.
      expect(v).not.toHaveProperty('fixHint');
      expect(v).not.toHaveProperty('context');
    }
  });

  it('returns the batches byte-identically on includeCommands (REQ-T03)', async () => {
    // The counterweight to the size budget below: a projection that LOST the batches
    // would ace a size test too. The opt-in has to hand back exactly what was written.
    await tools.graph_mutate.handler({ commands: BULK, consumerId: 't' });
    const [e] = (await tools.audit_trail.handler({ includeCommands: true })).entries as Entry[];

    expect(e.commands).toEqual(BULK);
    expect(e.commandCount).toBe(BULK.length);
  });

  it('reports commandCount 0 for a record that carries none (REQ-T05)', async () => {
    // A dryRun writes a `validate` record; export records and pre-CR entries are the same
    // shape. 0 is an answer, not an error.
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't', dryRun: true });
    const entries = (await tools.audit_trail.handler({})).entries as Entry[];
    const validate = entries.find((x) => x.operation === 'validate')!;

    expect(validate).toBeDefined();
    expect(typeof validate.commandCount).toBe('number');
    expect(validate.opSummary).toBeTruthy();
  });

  it('leaves audit_stats untouched (REQ-T06)', async () => {
    // Stats read the log, not the projection — the numbers must not move.
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't' });
    const stats = (await tools.audit_stats.handler({})) as AuditStats;
    expect(stats.window.entries).toBeGreaterThan(0);
    expect(stats.totals.applied).toBeGreaterThan(0);
  });

  it('drops the projection nowhere else — audit_stats is unaffected twice over', async () => {
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't' });
    const stats = (await tools.audit_stats.handler({})) as AuditStats;
    expect(stats.window.entries).toBeGreaterThan(0);
  });

  it('does not touch what was WRITTEN — the log keeps every field', async () => {
    // The whole design rests on this: disk stays the replay source and the learning
    // corpus. If the projection had leaked into recordAudit, replay would silently break.
    await tools.graph_mutate.handler({ commands: MIXED, consumerId: 't' });
    const [raw] = (await tools.audit_trail.handler({
      includeCommands: true,
      includeRulesPassed: true,
    })).entries as Entry[];

    expect(raw.commands).toEqual(MIXED);
    expect(raw).toHaveProperty('rulesPassed');
  });
});

/**
 * REQ-T04 measured where the CR says to measure it: on THIS repo's own trail. A fixture
 * cannot stand in — the ratio of commands to violations is the whole variable, and a
 * synthetic batch picks that ratio by accident. The real log is 79 % commands.
 *
 * That makes the block workspace-local by construction: `.graphcode/*` is gitignored, so a
 * fresh checkout (CI, or a clone before the first mutate) has no trail. It skips there
 * rather than failing — the claim is measured on every dev run, where the data is real.
 * The alternative, committing a sample, would freeze the very ratio being measured.
 */
const trail = join(process.cwd(), '.graphcode', 'audit.jsonl');

const REAL_TRAIL = 'TEST-audit-trail-projection: the size claim on real data (REQ-T04)';

describe.skipIf(!existsSync(trail))(REAL_TRAIL, () => {
  /**
   * MEASURED 2026-08-16 over THREE sliding 50-record windows of this repo's trail:
   *
   *   last 50            573.2 KB raw → 24.0 KB  =  4.2 %
   *   last 50 minus 50   158.4 KB raw → 13.0 KB  =  8.2 %
   *   last 50 minus 150  360.2 KB raw → 19.9 KB  =  5.5 %
   *
   * The bandwidth is the point (CR-GC-346 F3b). This case slices the LAST 50 records and
   * compares against an ABSOLUTE threshold, so its result depends on the shape of recent
   * work, not on the trail as a whole — before CR-GC-346 the same threshold read 13.6 %
   * here and 10.3 % one session earlier, i.e. it went red from batch width alone. Quoting
   * one snapshot would hide that; quoting the range says how much headroom is real.
   *
   * Why 11 % stays: it was the CR-GC-319 budget and nothing about the promise changed. The
   * measured value moved from 13.6 % to 4.2 % because violations stopped scaling with
   * batch width, not because the threshold was loosened to fit — loosening a threshold
   * until a test passes is how a suite learns a regression.
   *
   * This case alone cannot fail when the projection gets WORSE on a quiet trail, so the
   * synthetic counter-check below carries that half of the promise.
   */
  it('a default answer over the repo trail is ~89 % smaller than the raw records', () => {
    const raw = readFileSync(trail, 'utf8')
      .trim()
      .split('\n')
      .flatMap((l) => {
        try {
          const r = JSON.parse(l) as Record<string, unknown>;
          return r.id !== undefined ? [r] : []; // skip CHECKPOINT lines
        } catch {
          return [];
        }
      })
      .slice(-50); // the tool's default limit

    expect(raw.length, 'no audit records to measure against').toBeGreaterThan(0);

    const before = bytes({ entries: raw });
    const after = bytes({ entries: projectAuditEntries(raw) });

    expect(
      after,
      `${(after / 1024).toFixed(1)} KB projected vs ${(before / 1024).toFixed(1)} KB raw`,
    ).toBeLessThan(before * 0.11);
  });

  /**
   * The trail-independent half of the size promise (CR-GC-346 F3b).
   *
   * The case above measures the real trail, which means it re-calibrates against whatever
   * the last 50 operations happened to look like — it nods through what comes out. This one
   * has a KNOWN fat ratio, so it fails whenever the projection gets worse, no matter what
   * the local trail looks like today.
   */
  it('collapses a wide batch on a synthetic record — the claim without the trail', () => {
    // One record shaped like the three that took the size claim red: a batch over 28 nodes
    // emitting one non-gating info PER node, all from the same rule.
    const record = {
      id: 'audit-synthetic',
      timestamp: '2026-08-16T00:00:00.000Z',
      consumerId: 'synthetic',
      operation: 'mutate',
      result: 'applied',
      graphVersion: 1,
      commands: Array.from({ length: 28 }, (_, i) => ({
        op: 'add-node',
        node: { uid: `REQ-syn-${i}`, type: 'REQ', name: `Anforderung ${i}`, description: 'x'.repeat(200) },
      })),
      violations: Array.from({ length: 28 }, (_, i) => ({
        ruleId: 'VR-01',
        severity: 'info',
        elementId: `REQ-syn-${i}`,
        message: 'Dieses Element hat noch keine verifizierende Beziehung und zaehlt daher nicht als abgedeckt.',
        fixHint: 'Lege einen TEST an und verbinde ihn per verify-Kante mit dieser Anforderung.',
        context: { candidate_targets: [`TEST-syn-${i}`, `TEST-alt-${i}`] },
      })),
    };

    const before = bytes({ entries: [record] });
    const after = bytes({ entries: projectAuditEntries([record]) });
    expect(
      after,
      `${(after / 1024).toFixed(1)} KB projected vs ${(before / 1024).toFixed(1)} KB raw`,
    ).toBeLessThan(before * 0.11);
  });

  it('aggregates non-gating violations per rule — the count survives, the repetition goes', () => {
    const record = {
      id: 'audit-agg',
      timestamp: '2026-08-16T00:00:00.000Z',
      consumerId: 'agg',
      operation: 'mutate',
      result: 'rejected',
      graphVersion: 1,
      violations: [
        // A gating error: stays VERBATIM, because it is what explains the rejection.
        { ruleId: 'R-01', severity: 'error', elementId: 'REQ-x', message: 'REQ ohne verifizierenden TEST.' },
        ...Array.from({ length: 28 }, (_, i) => ({
          ruleId: 'VR-01',
          severity: 'info',
          elementId: `REQ-syn-${i}`,
          message: 'Noch nicht abgedeckt.',
        })),
        { ruleId: 'R-20', severity: 'warning', elementId: 'FUNC-a', message: 'Kein codeRef.' },
        { ruleId: 'R-20', severity: 'warning', elementId: 'FUNC-b', message: 'Kein codeRef.' },
      ],
    };

    const [projected] = projectAuditEntries([record]);
    const violations = projected.violations as Array<Record<string, unknown>>;

    // error first and complete — a rejection must stay explainable from the default answer.
    expect(violations[0]).toEqual({
      ruleId: 'R-01',
      severity: 'error',
      message: 'REQ ohne verifizierenden TEST.',
      elementId: 'REQ-x',
    });
    // 28 identical infos become ONE entry that still says 28. No silent cap.
    expect(violations[1]).toEqual({ ruleId: 'VR-01', severity: 'info', count: 28 });
    expect(violations[2]).toEqual({ ruleId: 'R-20', severity: 'warning', count: 2 });
    expect(violations).toHaveLength(3);
    // The total is recoverable: 1 error + 28 + 2 = 31, exactly what went in.
    const total = violations.reduce((n, v) => n + ((v.count as number) ?? 1), 0);
    expect(total).toBe(31);
  });

  it('keeps every record — smaller must not mean fewer', () => {
    const raw = readFileSync(trail, 'utf8')
      .trim()
      .split('\n')
      .flatMap((l) => {
        try {
          const r = JSON.parse(l) as Record<string, unknown>;
          return r.id !== undefined ? [r] : [];
        } catch {
          return [];
        }
      });
    expect(projectAuditEntries(raw)).toHaveLength(raw.length);
  });
});
