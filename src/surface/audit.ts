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
import type { OperationsLog } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import type { MCPTool, MCPToolRegistry } from '../kernel/tool-contract.js';
import type { ToolContext } from './tool-context.js';
import { aggregateAuditEntries, type AuditStats, type RawAuditEntry } from './audit-stats.js';

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

/**
 * Violations, delivered as the EVENT and not as the VOLUME (CR-GC-346 F3).
 *
 * CR-GC-319 dropped `commands` because they scale with batch width. Violations scale the
 * same way and were kept verbatim: a batch over 28 nodes emits 28 VR-01 infos, and three
 * such records carried 40.3 KB of a 61.8 KB answer — the size claim went red on that alone.
 *
 * `error` stays VERBATIM including `elementId` and `message`: it explains a rejection, and
 * a rejection that cannot be explained from the default answer defeats the point of the
 * tool. `warning`/`info` (never gate-relevant, CR-SM-353) collapse per (ruleId, severity) to a count.
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
    // CR-GC-943: der Skill, den der Schreiber genannt hat. Fehlt das Feld, ist er nicht erfasst.
    ...(e.skill !== undefined ? { skill: e.skill } : {}),
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
// Binding
// -------------------------------------------------------------------------

export function bindAuditTools(ctx: ToolContext) {
  const { auditLog, graphVersion } = ctx;

  const audit_trail: MCPTool<
    typeof AuditTrailInputSchema,
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
        // Read across archived segments (CR-GC-349): compaction rotates the ACTIVE file, so
        // without this the history silently starts at the last checkpoint.
        includeArchived: true,
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

  const audit_stats: MCPTool<typeof AuditStatsInputSchema, AuditStats> = {
    name: 'audit_stats',
    description:
      'Aggregate the audit log per rule, consumer, model and skill (CR-GC-347, CR-GC-943): which rule ' +
      'blocks whom, how often. `blocked` counts RECORDS, `occurrences` violations; a record can violate ' +
      'several rules, so form percentages against totals.rejected. `firedIn` = records with a finding ' +
      'of the rule, `evaluatedIn` = records it ran in; `firedIn: null` = in the catalog, never seen ' +
      'running. `passed`/`passRate`/`evaluatedIn` are null when NOT RECORDED, never zero. `bySkill`: ' +
      'the skill named on graph_mutate, `skill: null` = not recorded. `topBlockingRule` is null on a ' +
      'tie. Narrow with since/consumerId.',
    inputSchema: AuditStatsInputSchema,
    async handler(input) {
      const all = await auditLog.query({
        since: input.since,
        consumerId: input.consumerId,
        includeArchived: true,
      });
      // The horizon is reported, not assumed. An InMemoryAuditLog (tests) has neither method;
      // absent capability reads as "no archives", which is exactly true for it.
      const durable = auditLog as Partial<Pick<OperationsLog, 'archives' | 'baseVersion'>>;
      return aggregateAuditEntries(all as unknown as RawAuditEntry[], graphVersion(), {
        archives: durable.archives?.().length ?? 0,
        checkpointVersion: durable.baseVersion?.() ?? 0,
        catalog: ALL_RULE_DEFS.map((r) => r.id),
      });
    },
  };

  return { audit_trail, audit_stats } satisfies MCPToolRegistry;
}
