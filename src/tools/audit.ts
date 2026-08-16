/**
 * tools/audit.ts — the audit-trail tool group (CR-GC-347).
 *
 * Split out of `report.ts`, which had grown to 625 lines against the 500-line limit and
 * whose own header called this case: "with nine tools this is the group that will hit the
 * 500-line limit first — the next reporting tool splits it, it does not grow" (CR-GC-256 §6).
 *
 * Two tools, one job: hand out what the trail records. `audit_trail` answers "what happened"
 * per record; `audit_stats` answers "which rule blocks whom, how often" in aggregate — the
 * question you ask a trail when you are calibrating thresholds rather than reading history
 * (UC-loop-closure / REQ-rule-calibration, CR-GC-346).
 *
 * The house rule for both, from CR-GC-314 and CR-GC-319: WRITING IS NOT DELIVERING. The
 * record on disk stays complete — it is the replay source and the calibration corpus. What
 * an agent is handed is a projection.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

const AuditTrailInputSchema = z.object({
  consumerId: z.string().optional(),
  since: z.string().optional().describe('ISO 8601 timestamp lower bound'),
  limit: z.number().int().positive().default(50),
  includeRulesPassed: z
    .boolean()
    .default(false)
    .describe(
      'CR-GC-314: include the positive half (rulesPassed — every rule that ran on that ' +
        'mutation without a finding). OFF by default and deliberately so: it is ~60 rule ' +
        'ids PER ENTRY, written for a file-reading learning mechanism, not for an agent ' +
        'that wants to know what went wrong. Turning it on multiplies the payload.',
    ),
  includeCommands: z
    .boolean()
    .default(false)
    .describe(
      'CR-GC-319: include the full mutate batch per record. OFF by default — commands are ' +
        "79 % of this repo's trail (129 KB of 163 KB in the last 50 records). The one " +
        'consumer that needs them is the replay-merge, and it reads the JSONL file ' +
        'directly, not this tool. Ask for them when you actually intend to replay.',
    ),
  includeIntent: z
    .boolean()
    .default(false)
    .describe(
      'CR-GC-354/346: include the verbatim triggering prompt per record. OFF by default — a ' +
        'prompt is up to 4000 chars, the same volume-not-event trade commands lost. sessionId ' +
        'and model are always included; ask for the prompt text when you are calibrating ' +
        'prompts rather than reading what happened.',
    ),
});

const AuditStatsInputSchema = z.object({
  since: z.string().optional().describe('ISO 8601 timestamp lower bound — same filter as audit_trail'),
  consumerId: z.string().optional().describe('Restrict to one consumer'),
});

// -------------------------------------------------------------------------
// Projection (per record)
// -------------------------------------------------------------------------

/** `+n ~n -n` over a mutate batch — the shape of a change without its content (CR-GC-319). */
function opSummary(commands: readonly unknown[] | undefined): string {
  let added = 0;
  let updated = 0;
  let deleted = 0;
  for (const c of commands ?? []) {
    const op = String((c as { op?: unknown }).op ?? '');
    if (op.startsWith('add-')) added += 1;
    else if (op.startsWith('delete-')) deleted += 1;
    else updated += 1; // update-node/update-edge/merge-nodes
  }
  return `+${added} ~${updated} -${deleted}`;
}

/** One audit record as written to disk — only the fields the projection reads. */
type RawAuditEntry = Record<string, unknown> & {
  commands?: unknown[];
  violations?: Array<Record<string, unknown>>;
  rulesetVersion?: string;
  rulesPassed?: string[];
  sessionId?: string;
  model?: string;
  intent?: string;
  intentTruncated?: boolean;
};

/**
 * Violations, delivered as the EVENT and not as the VOLUME (CR-GC-346 F3).
 *
 * CR-GC-319 dropped `commands` because they scale with batch width. Violations scale the
 * same way and were kept verbatim: a batch over 28 nodes emits 28 VR-01 infos, and three
 * such records carried 40.3 KB of a 61.8 KB answer — the size claim went red on that alone.
 *
 * `error` stays VERBATIM including `elementId` and `message`: it explains a rejection, and
 * a rejection that cannot be explained from the default answer defeats the point of the
 * tool. Non-gating `warning`/`info` collapse per (ruleId, severity) to a count.
 *
 * NO SILENT CAP — the count is exact, only the repetition of identical prose is gone. The
 * elementIds stay in full in the record on disk, and for the LIVING graph they are what
 * `rules_get_violations` returns. First-encounter order is kept, so the answer reads in the
 * order the engine produced and stays byte-stable across runs.
 */
function projectViolations(
  violations: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const grouped = new Map<string, Record<string, unknown>>();
  for (const v of violations) {
    if (v.severity === 'error') {
      out.push({ ruleId: v.ruleId, severity: v.severity, message: v.message, elementId: v.elementId });
      continue;
    }
    const key = String(v.ruleId) + ' ' + String(v.severity);
    const seen = grouped.get(key);
    if (seen) {
      seen.count = (seen.count as number) + 1;
      continue;
    }
    const entry: Record<string, unknown> = { ruleId: v.ruleId, severity: v.severity, count: 1 };
    grouped.set(key, entry);
    out.push(entry);
  }
  return out;
}

/**
 * The lean `audit_trail` payload (CR-GC-319). Pure, so the size claim can be measured
 * against this repo's REAL trail instead of a fixture whose violation-to-command ratio
 * happens to differ from reality.
 *
 * CR-GC-319 / CR-GC-314, one rule: WRITING is not DELIVERING. The record on disk stays
 * complete — it is the replay source and the learning corpus. What an agent gets is a
 * projection, because it asks the trail to learn WHAT HAPPENED, not to replay batches.
 * Measured on this repo's own trail, a default call was 163 KB (~40k tokens) of which
 * 79 % were mutate batches no agent reads.
 *
 * Query precision (R12), not result compression: the heavy halves stay available in
 * full — you ask for them when you intend to use them. The one consumer that truly needs
 * `commands`, the replay-merge, reads the JSONL file directly (src/merge.ts).
 */
export function projectAuditEntries(
  entries: readonly RawAuditEntry[],
  opts: { includeCommands?: boolean; includeRulesPassed?: boolean; includeIntent?: boolean } = {},
): Array<Record<string, unknown>> {
  return entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    consumerId: e.consumerId,
    operation: e.operation,
    result: e.result,
    graphVersion: e.graphVersion,
    // The SHAPE of the change, not its content. A validate/export record and any pre-CR
    // entry carry no commands — that is 0, never an error (REQ-T05).
    commandCount: e.commands?.length ?? 0,
    opSummary: opSummary(e.commands),
    // Slim violations: what fired and where. `fixHint`/`context` carry candidate_targets
    // and are the bulk of the remaining bytes — they live in rules_get_violations, the
    // tool whose job is repairing (REQ-T02).
    ...(e.violations !== undefined ? { violations: projectViolations(e.violations) } : {}),
    // Provenance (CR-GC-354): who, and in which session. Both are ~50 B together and they
    // answer half of what the trail is FOR, so they are default fields. `intent` is not —
    // it is a full prompt, i.e. the same "volume, not event" trade `commands` lost.
    ...(e.sessionId !== undefined ? { sessionId: e.sessionId } : {}),
    ...(e.model !== undefined ? { model: e.model } : {}),
    ...(opts.includeIntent && e.intent !== undefined
      ? {
          intent: e.intent,
          ...(e.intentTruncated !== undefined ? { intentTruncated: e.intentTruncated } : {}),
        }
      : {}),
    // Opt-in halves, added back whole — never a truncated stand-in, which would read as
    // "this is all there was".
    ...(opts.includeCommands && e.commands !== undefined ? { commands: e.commands } : {}),
    // `rulesetVersion` travels with `rulesPassed`: both describe the RULE SET, not what
    // happened, and both address the learning consumer. REQ-T01 lists neither in the
    // default field set, and per-record rule-set metadata on an answer nobody reads it
    // from is just weight.
    ...(opts.includeRulesPassed
      ? {
          ...(e.rulesPassed !== undefined ? { rulesPassed: e.rulesPassed } : {}),
          ...(e.rulesetVersion !== undefined ? { rulesetVersion: e.rulesetVersion } : {}),
        }
      : {}),
  }));
}

// -------------------------------------------------------------------------
// Aggregation (across records) — CR-GC-347
// -------------------------------------------------------------------------

export interface RuleStat {
  ruleId: string;
  /** Records with result 'rejected' that carried this rule as an ERROR — blockades, not findings. */
  blocked: number;
  /** Occurrences in total, every severity — the finding count, which is a different number. */
  occurrences: number;
  bySeverity: { error: number; warning: number; info: number };
  /** From `rulesPassed`. `null` means NOT RECORDED, never "passed zero times". */
  passed: number | null;
  /** `null` whenever the population is incomplete — never optimistically computed. */
  passRate: number | null;
}

export interface ConsumerStat {
  consumerId: string;
  applied: number;
  rejected: number;
  /** `null` on a tie — an invented winner is worse than no winner. */
  topBlockingRule: string | null;
}

export interface ModelStat {
  model: string;
  applied: number;
  rejected: number;
  topBlockingRule: string | null;
}

export interface AuditStats {
  window: { since: string | null; until: string | null; entries: number };
  totals: { applied: number; rejected: number; partial: number };
  byRule: RuleStat[];
  byConsumer: ConsumerStat[];
  /** CR-GC-354/355: the dimension CR-GC-284 broke down by and could not read from a record. */
  byModel: ModelStat[];
  graphVersion: number;
}

/**
 * The most-blocking rule for one actor, or `null` on a tie.
 *
 * A tie is genuinely undecided, and picking the alphabetically first would read as a
 * finding. Same rule as everywhere else in this file: the absence of an answer is itself
 * the honest answer.
 */
function topBlocker(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [ruleId, n] of counts) {
    if (n > bestCount) {
      best = ruleId;
      bestCount = n;
      tied = false;
    } else if (n === bestCount && n > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Aggregate the trail per rule, per consumer and per model (CR-GC-347).
 *
 * This is the table four CRs were built on — CR-GC-284 ("R-01 dominated the rejections of
 * every model: Haiku 26/29, Opus 17/18, devstral 10/23"), CR-GC-286, CR-GC-290, CR-GC-292 —
 * and every one of them was produced by hand with a `jq` line, because no tool could answer
 * it. An agent that only has MCP tools could not ask the question at all.
 *
 * COUNTING RULES, spelled out because they are otherwise read wrong:
 *
 *  - A record can violate SEVERAL rules. `sum(byRule[].blocked) > totals.rejected` is the
 *    normal case, not an error. A percentage is formed against `totals.rejected`, never
 *    against that sum.
 *  - `blocked` counts RECORDS, `occurrences` counts VIOLATIONS. Twenty R-29 violations in
 *    one rejected batch are ONE blockade by that rule and twenty occurrences. Both numbers
 *    are here because both are needed and the confusion is otherwise silent.
 *  - `passed: null` means NOT RECORDED, never "passed zero times" — on this repo's trail
 *    that holds for the records older than CR-GC-314. `passRate` is therefore `null` as
 *    soon as the population is incomplete, rather than optimistically computed.
 */
export function aggregateAuditEntries(
  entries: readonly RawAuditEntry[],
  graphVersion: number,
): AuditStats {
  const rules = new Map<string, RuleStat & { seenPassRecords: number }>();
  const consumers = new Map<string, { applied: number; rejected: number; blockers: Map<string, number> }>();
  const models = new Map<string, { applied: number; rejected: number; blockers: Map<string, number> }>();
  let applied = 0;
  let rejected = 0;
  let partial = 0;
  let since: string | null = null;
  let until: string | null = null;

  function ruleStat(ruleId: string): RuleStat & { seenPassRecords: number } {
    let s = rules.get(ruleId);
    if (!s) {
      s = {
        ruleId,
        blocked: 0,
        occurrences: 0,
        bySeverity: { error: 0, warning: 0, info: 0 },
        passed: null,
        passRate: null,
        seenPassRecords: 0,
      };
      rules.set(ruleId, s);
    }
    return s;
  }

  for (const e of entries) {
    const ts = typeof e.timestamp === 'string' ? e.timestamp : null;
    if (ts) {
      if (since === null || ts < since) since = ts;
      if (until === null || ts > until) until = ts;
    }
    if (e.result === 'applied') applied += 1;
    else if (e.result === 'rejected') rejected += 1;
    else if (e.result === 'partial') partial += 1;

    // A rule blocks a RECORD at most once, however many elements it fired on.
    const blockingHere = new Set<string>();
    for (const v of e.violations ?? []) {
      const ruleId = String(v.ruleId ?? '');
      if (!ruleId) continue;
      const s = ruleStat(ruleId);
      s.occurrences += 1;
      const sev = String(v.severity ?? '');
      if (sev === 'error' || sev === 'warning' || sev === 'info') s.bySeverity[sev] += 1;
      if (sev === 'error' && e.result === 'rejected') blockingHere.add(ruleId);
    }
    for (const ruleId of blockingHere) ruleStat(ruleId).blocked += 1;

    for (const ruleId of e.rulesPassed ?? []) {
      const s = ruleStat(String(ruleId));
      s.passed = (s.passed ?? 0) + 1;
      s.seenPassRecords += 1;
    }

    const consumerId = typeof e.consumerId === 'string' ? e.consumerId : 'unknown';
    let c = consumers.get(consumerId);
    if (!c) {
      c = { applied: 0, rejected: 0, blockers: new Map() };
      consumers.set(consumerId, c);
    }
    if (e.result === 'applied') c.applied += 1;
    else if (e.result === 'rejected') c.rejected += 1;
    for (const ruleId of blockingHere) c.blockers.set(ruleId, (c.blockers.get(ruleId) ?? 0) + 1);

    // `model` is absent on every record written before CR-GC-354 and on every client that
    // cannot supply it — those records simply do not appear in byModel, which is the honest
    // reading of an absent field (they are NOT lumped into an "unknown" model that would
    // then look like a real actor with a real block rate).
    if (typeof e.model === 'string' && e.model) {
      let m = models.get(e.model);
      if (!m) {
        m = { applied: 0, rejected: 0, blockers: new Map() };
        models.set(e.model, m);
      }
      if (e.result === 'applied') m.applied += 1;
      else if (e.result === 'rejected') m.rejected += 1;
      for (const ruleId of blockingHere) m.blockers.set(ruleId, (m.blockers.get(ruleId) ?? 0) + 1);
    }
  }

  // A pass RATE needs a complete population. `rulesPassed` only exists since CR-GC-314, so
  // over a window that reaches further back the denominator is unknown — and a rate computed
  // on a partial denominator would read as fact. Hence: recorded on EVERY entry, or null.
  const total = entries.length;
  const byRule: RuleStat[] = [...rules.values()]
    .map(({ seenPassRecords, ...s }) => ({
      ...s,
      passRate:
        s.passed !== null && seenPassRecords === total && total > 0 ? s.passed / total : null,
    }))
    .sort((a, b) => b.blocked - a.blocked || b.occurrences - a.occurrences || a.ruleId.localeCompare(b.ruleId));

  const byConsumer: ConsumerStat[] = [...consumers.entries()]
    .map(([consumerId, c]) => ({
      consumerId,
      applied: c.applied,
      rejected: c.rejected,
      topBlockingRule: topBlocker(c.blockers),
    }))
    .sort((a, b) => b.rejected - a.rejected || b.applied - a.applied || a.consumerId.localeCompare(b.consumerId));

  const byModel: ModelStat[] = [...models.entries()]
    .map(([model, m]) => ({
      model,
      applied: m.applied,
      rejected: m.rejected,
      topBlockingRule: topBlocker(m.blockers),
    }))
    .sort((a, b) => b.rejected - a.rejected || b.applied - a.applied || a.model.localeCompare(b.model));

  return {
    window: { since, until, entries: total },
    totals: { applied, rejected, partial },
    byRule,
    byConsumer,
    byModel,
    graphVersion,
  };
}

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindAuditTools(ctx: ToolContext): MCPToolRegistry {
  const { auditLog, graphVersion } = ctx;

  const audit_trail: MCPTool<
    z.infer<typeof AuditTrailInputSchema>,
    { entries: Array<Record<string, unknown>> }
  > = {
    name: 'audit_trail',
    description:
      'Return mutation history from the audit log as a LEAN PROJECTION (CR-GC-319): what ' +
      'happened, when, by whom, with what verdict — plus commandCount + opSummary (+n ~n -n) ' +
      'as the shape of each change. The full batches (includeCommands) and the positive ' +
      'half (includeRulesPassed, CR-GC-314) are opt-in. Nothing is dropped from the log on ' +
      'disk; this is about what an agent is handed.',
    inputSchema: AuditTrailInputSchema,
    async handler(input) {
      const entries = await auditLog.query({
        consumerId: input.consumerId,
        since: input.since,
        limit: input.limit,
      });
      return {
        entries: projectAuditEntries(entries as unknown as RawAuditEntry[], {
          includeCommands: input.includeCommands,
          includeRulesPassed: input.includeRulesPassed,
          includeIntent: input.includeIntent,
        }),
      };
    },
  };

  const audit_stats: MCPTool<z.infer<typeof AuditStatsInputSchema>, AuditStats> = {
    name: 'audit_stats',
    description:
      'Aggregate the audit log PER RULE, PER CONSUMER and PER MODEL (CR-GC-347): which rule ' +
      'blocks whom, how often, and how often it passed. This is the calibration question — ' +
      'the input to every threshold decision (REQ-rule-calibration) — and it used to be a jq ' +
      'line no agent could run. Counting: `blocked` counts RECORDS (twenty violations of one ' +
      'rule in one rejected batch = 1), `occurrences` counts violations; a record can violate ' +
      'several rules, so sum(byRule.blocked) > totals.rejected is normal — form percentages ' +
      'against totals.rejected. `passed`/`passRate` are null when NOT RECORDED (pre-CR-GC-314 ' +
      'records), never zero. `topBlockingRule` is null on a tie. Output grows with rules × ' +
      'consumers, not with records; narrow with since/consumerId rather than expecting a cut.',
    inputSchema: AuditStatsInputSchema,
    async handler(input) {
      const all = await auditLog.query({ since: input.since, consumerId: input.consumerId });
      return aggregateAuditEntries(all as unknown as RawAuditEntry[], graphVersion());
    },
  };

  return { audit_trail, audit_stats };
}
