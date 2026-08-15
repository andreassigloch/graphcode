/**
 * tools/report.ts — read-only REPORTING tools (MOD-mcp-tools, CR-GC-256).
 *
 * The derived views on the governed graph: rules (rules_evaluate /
 * rules_get_violations / graph_next_step), audit (audit_trail / audit_stats),
 * readiness (graph_readiness), selective tests (graph_tests) and the authoring /
 * help surface (graph_help / graph_authoring_guide). All read-only — every number
 * here is derived from `harness.evaluateRules()` or the audit log, never stored.
 *
 * Size guard (CR-GC-256 §6): with nine tools this is the group that will hit the
 * 500-line limit first — the next reporting tool splits it, it does not grow.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import type { GraphNode } from '@sigloch/graph-api-core';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import {
  TestRefSchema,
  type TestRef,
  TRACE_PATTERNS,
  PHASE_READINESS_NAME,
  DIMENSION_READINESS_NAME,
  ReadinessDimension,
  type ReadinessScoreType,
} from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from '../steering-snapshot.js';
import {
  summarizeReadiness,
  computePhaseReadiness,
  type ReadinessReport,
  type PhaseGateReadiness,
} from '../readiness.js';
import { scoreReadinessWithConformance, conformanceViolations } from '../conformance.js';
import { loadTargetProfile, intentCoverage, type AnchorCoverage } from '../target-profile.js';
import { helpEntry, contextualHelp, type HelpEntry, type ContextualMeasure } from '../viewer/help.js';
import { formatEExampleFor } from '../authoring-example.js';
import { nextStep } from '../steering.js';
import type { NextStepResult } from '../steering.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

const RulesEvaluateInputSchema = z.looseObject({});
const GraphNextStepInputSchema = z.looseObject({});

const RulesGetViolationsInputSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']).optional(),
});

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
        '79 % of this repo\'s trail (129 KB of 163 KB in the last 50 records). The one ' +
        'consumer that needs them is the replay-merge, and it reads the JSONL file ' +
        'directly, not this tool. Ask for them when you actually intend to replay.',
    ),
});

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
};

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
  opts: { includeCommands?: boolean; includeRulesPassed?: boolean } = {},
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
    ...(e.violations !== undefined
      ? {
          violations: e.violations.map((v) => ({
            ruleId: v.ruleId,
            severity: v.severity,
            message: v.message,
            elementId: v.elementId,
          })),
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

const AuditStatsInputSchema = z.looseObject({});

const GraphReadinessInputSchema = z.object({
  detail: z
    .boolean()
    .default(false)
    .describe(
      'false (default) = summary: scores + counts + violationsByRule only (stays within the MCP ' +
        'result limit on a fully-red graph). true = full raw violations + each gate’s blocking/open lists.',
    ),
});

const GraphHelpInputSchema = z.object({
  token: z
    .string()
    .optional()
    .describe(
      'Optional dashboard token to explain: a ruleId (R-04), gate (CDR), panel id (recommendations), ' +
        'artifact id (fmea), or vocabulary token (REQ). Omit for the contextual, ranked, explained ' +
        'measures derived from the live readiness + violations (the explained Recommendations).',
    ),
});

/** Authoring-guide input (CR-GC-231) — which ElementType to surface legal edges for. */
const GraphAuthoringGuideInputSchema = z.object({
  type: z.string().describe('The ElementType to author (e.g. UC, REQ, FUNC, TEST, MOD, ACTOR).'),
});

const GraphTestsInputSchema = z.object({
  changeSet: z
    .array(z.string())
    .min(1)
    .describe('Changed node uids (e.g. git-diff → graph). The roots of the blast-radius.'),
  depth: z
    .number()
    .int()
    .nonnegative()
    .default(1)
    .describe('Impact traversal depth per changed node (same semantics as graph_impact).'),
});

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindReportTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, auditLog, graphVersion } = ctx;

  const rules_evaluate: MCPTool<z.infer<typeof RulesEvaluateInputSchema>, { violations: RuleViolation[] }> = {
    name: 'rules_evaluate',
    description: 'Evaluate V3_RULES against the current in-memory graph. Read-only; does not mutate.',
    inputSchema: RulesEvaluateInputSchema,
    async handler(_input) {
      return { violations: harness.evaluateRules() };
    },
  };

  const rules_get_violations: MCPTool<
    z.infer<typeof RulesGetViolationsInputSchema>,
    { violations: RuleViolation[]; total: number }
  > = {
    name: 'rules_get_violations',
    description:
      'Return current rule violations, optionally filtered by severity. Each violation carries ' +
      'fixHint + context (candidate_targets, existing_traces) from the contracts rule (CR-GC-203 ' +
      'item 1), so an agent can resolve R-01/RD-01 from the payload — no extra queries to find ' +
      'a TEST/FUNC to link.',
    inputSchema: RulesGetViolationsInputSchema,
    async handler(input) {
      let violations = harness.evaluateRules();
      if (input.severity) violations = violations.filter((v) => v.severity === input.severity);
      return { violations, total: violations.length };
    },
  };

  const graph_next_step: MCPTool<z.infer<typeof GraphNextStepInputSchema>, NextStepResult> = {
    name: 'graph_next_step',
    description:
      'Read-only "next best step": condenses the full advisory rule set into ONE ' +
      'causally-grounded action — the highest readiness-deficit dimension, the rules ' +
      'firing in it (clears), a concrete action, plus error blockers and lower-priority ' +
      'advisories. Deterministic (readiness → weight vector via @sigloch/se-steering), no ' +
      'LLM/learning. Complements rules_get_violations (the flat gate list) by prioritising.',
    inputSchema: GraphNextStepInputSchema,
    async handler(_input) {
      return nextStep(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());
    },
  };

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
        }),
      };
    },
  };

  const audit_stats: MCPTool<
    z.infer<typeof AuditStatsInputSchema>,
    { totalEntries: number; applied: number; rejected: number; graphVersion: number }
  > = {
    name: 'audit_stats',
    description: 'Aggregate stats from the audit log: counts of applied vs. rejected mutations.',
    inputSchema: AuditStatsInputSchema,
    async handler(_input) {
      const all = await auditLog.query({});
      const applied = all.filter((e) => e.result === 'applied').length;
      const rejected = all.filter((e) => e.result === 'rejected').length;
      return { totalEntries: all.length, applied, rejected, graphVersion: graphVersion() };
    },
  };

  // READINESS tool — exposes the family compliance score (CR-GC-107 / MOD-readiness)
  // over the agent surface. se-review / se-status read it instead of the retired
  // GET /api/graph/readiness. Delegates to scoreReadiness(harness) → evaluateRules()
  // (L2 gate) so the score is driven by contracts V3_RULES (R-/RD-), never foreign BQ-*.

  /**
   * CR-GC-325: die 8 RULE_TO_DIMENSION-Themenscores.
   *
   * Keine zweite Rechnung: `computeReadiness` aus @sigloch/se-steering bleibt die
   * einzige Implementierung, hier wird ihr Ergebnis aus DEMSELBEN Snapshot
   * durchgereicht, den `nextStep` benutzt (CR-GC-324). Deshalb ist der Score, den
   * ein Dashboard zeigt, exakt der, aus dem die Empfehlung entstand.
   *
   * VOLLSTÄNDIG: die Reihenfolge kommt aus `ReadinessDimension.options`, damit eine
   * fehlende Dimension nicht als "alles gut" durchgeht. Fehlt eine im Report, wird
   * sie mit `applicable: 0` ausgewiesen — konstruktiv nicht messbar, NICHT perfekt
   * (Muster computeSteeringDelta).
   */
  const dimensionReadiness = (): ReadinessScoreType[] => {
    const scores = new Map(takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold()).report.scores.map((s) => [s.dimension as string, s]));
    return ReadinessDimension.options.map(
      (dimension) =>
        scores.get(dimension) ?? { dimension, score: 0, violations: 0, applicable: 0, ready: false },
    );
  };

  const graph_readiness: MCPTool<
    z.infer<typeof GraphReadinessInputSchema>,
    ReadinessReport & {
      [PHASE_READINESS_NAME]: PhaseGateReadiness[];
      /** CR-GC-325: die 8 RULE_TO_DIMENSION-Themenscores — die zweite Projektion
       * DESSELBEN Regelstroms, aus DEMSELBEN Snapshot wie nextStep. */
      [DIMENSION_READINESS_NAME]: ReadinessScoreType[];
      graphVersion: number;
      /** Intent-Coverage-Read-out (CR-GC-295): je bestätigtem Anker, ob/wo er in
       * UC/REQ/FUNC adressiert ist. KPI, NIE ein Gate-Blocker — Abdeckung sagt
       * "adressiert", nicht "gut gelöst". null ohne Config/intentAnchors. */
      intentCoverage: AnchorCoverage[] | null;
    }
  > = {
    name: 'graph_readiness',
    description:
      // CR-GC-332: der frühere Verweis nannte `FUNC-score-readiness` — einen Knoten, den
      // das Modell nie enthielt. Jetzt steht hier die Stelle, die es wirklich gibt.
      'Score family readiness of the live governed graph (FUNC-compute-readiness / CR-GC-107 + CR-GC-125). ' +
      'Returns the ReadinessReport: compliance dimension (fraction of elements with no error-severity ' +
      'violation); incoseScope (graphcode = lean); phaseGates SRR/PDR/CDR/TRR (INCOSE technical reviews, ' +
      'a disjoint partition of the element-level V3_RULES, with structural derivation-chain completeness); ' +
      `implGates SAR/FCA/SVR/FRR (milestone tiers MS-1..4, ready iff assigned CRs are done + scope ` +
      `error-clean); ${PHASE_READINESS_NAME} (CR-GC-296) — the SAME SRR/PDR/CDR/TRR gates from the OTHER ` +
      'axis: per-gate rule coverage (covered/total distinct rule IDs from RULE_TO_PHASE with zero open ' +
      'violations, any severity, + the missing rule IDs) — orthogonal to phaseGates\' element-completeness; ' +
      `${DIMENSION_READINESS_NAME} (CR-GC-325) — the 8 RULE_TO_DIMENSION topic scores ` +
      '(req/uc/arch/alloc/ver/schema/cr/ms), the OTHER projection of the same rule stream: each with ' +
      'score, violations, applicable (the denominator — a score is not interpretable without it) and ' +
      'ready (contracts threshold, not a graphcode policy). Steering values, NOT a gate: the gates stay ' +
      'the pass/fail authority. Computed from the same steering snapshot graph_next_step uses, so the ' +
      'number a dashboard shows is the one the recommendation came from; ' +
      'violationsByRule (keyed by contracts rule-ID — R-/RD-/MS-, never BQ-*); intentCoverage ' +
      '(CR-GC-295: per content theme from .graphcode/target-profile.json, whether/where it is ' +
      'addressed in UC/REQ/FUNC — a KPI, never a gate blocker; null without config. CR-GC-307: the themes are ' +
      'derived and persisted in the BACKGROUND, never confirmed by the human — this read-out is machine-facing, ' +
      'so relay its content in plain language, never as "intent anchors"); and computedAt. By DEFAULT ' +
      'returns a summary (no raw violations, no per-gate blocking/open lists) so it stays within the MCP ' +
      `result limit even on a fully-red graph; pass detail:true for the full lists (${PHASE_READINESS_NAME} ` +
      'stays in both — it is already a small aggregate). Read-only; derived from harness.evaluateRules() ' +
      '(L2 gate) + RC code-conformance (CR-GC-253: realRef/testRef resolved against the real source tree) ' +
      '+ the MS nodes + element status.',
    inputSchema: GraphReadinessInputSchema,
    async handler(input) {
      const report = scoreReadinessWithConformance(harness);
      const phaseReadiness = computePhaseReadiness(report.violations);
      // Intent-Coverage (CR-GC-295): nur wenn die Config bestätigte Anker trägt;
      // der Loader prüft dabei auch die Zielkonflikt-Paare (Warning, kein Block).
      const anchors = loadTargetProfile(harness.getRepoRoot())?.profile.intentAnchors ?? [];
      const coverage =
        anchors.length > 0
          ? intentCoverage(
              anchors,
              harness.getGraph().nodes.map((n) => ({ id: n.uid, type: n.type, name: n.name, description: n.description })),
            )
          : null;
      return {
        ...(input.detail ? report : summarizeReadiness(report)),
        [PHASE_READINESS_NAME]: phaseReadiness,
        [DIMENSION_READINESS_NAME]: dimensionReadiness(),
        graphVersion: graphVersion(),
        intentCoverage: coverage,
      };
    },
  };

  // TEST-DEDUCTION tool — selective test set (CR-GC-134 + CR-GC-204 / FUNC-deduce-tests
  // + FUNC-resolve-tests-from-code). Resolves the impacted TEST nodes via the SINGLE
  // harness.testImpact() traversal (one getSubgraph primitive, no parallel blast-radius):
  // a CODE changeset (MOD/FUNC) is walked DIRECTIONALLY `node →satisfy/allocate→ REQ
  // →verify→ TEST`, a REQ changeset degenerates to its verify-dependents. Each impacted
  // TEST is resolved via its `testRef` runnable binding to a concrete file; the emitted
  // command runs ONLY those affected test files — never the full suite. TESTs without a
  // testRef (concept-only, marked `testRef:null`) surface under `unresolved`, never lost.
  //
  // git-diff → node: the changeSet is graph node uids, not paths. The agent maps a
  // changed source file to its node by the repo's MOD/FUNC naming convention
  // (`src/codec.ts` → `MOD-codec`, a function → its `FUNC-*`); `graph_elements({search})`
  // looks the uid up when the convention is ambiguous. graph_tests stays path-agnostic so
  // the same deduction works for any consumer regardless of its file layout.

  const graph_tests: MCPTool<
    z.infer<typeof GraphTestsInputSchema>,
    {
      command: string;
      tests: Array<{ id: string; name: string; testRef: TestRef }>;
      coverage: { changeSet: string[]; impactedNodes: number; impactedTests: number; resolved: number; files: string[] };
      unresolved: Array<{ id: string; name: string; reason: string }>;
    }
  > = {
    name: 'graph_tests',
    description:
      'Deduce the minimal selective test set for a change (FUNC-deduce-tests / CR-GC-134 + ' +
      'FUNC-resolve-tests-from-code / CR-GC-204). Maps a changeSet (changed node uids — a CODE ' +
      'node MOD/FUNC or a REQ) → impacted TEST nodes via the SINGLE harness.testImpact() traversal: ' +
      'a code node is walked DIRECTIONALLY `node →satisfy/allocate→ REQ →verify→ TEST` (not plain ' +
      'incoming-impact, which never reaches a code node’s tests), a REQ degenerates to its verify- ' +
      'dependents. Resolves each impacted TEST via its `testRef` binding {file, case?, tool, level?} ' +
      'and emits the minimal `vitest run <only-affected-files>` command + coverage. TESTs without a ' +
      'resolvable testRef (concept-only) are reported under `unresolved` (never silently dropped).',
    inputSchema: GraphTestsInputSchema,
    async handler(input) {
      // Directed code→REQ→TEST resolution via the SINGLE getSubgraph primitive
      // (harness.testImpact — one traversal path, no second blast-radius).
      const directed = await harness.testImpact(input.changeSet, input.depth);
      const impacted = new Map<string, GraphNode>();
      for (const node of directed.nodes) impacted.set(node.uid, node);

      const impactedTests = [...impacted.values()].filter((n) => n.type === 'TEST');

      const tests: Array<{ id: string; name: string; testRef: TestRef }> = [];
      const unresolved: Array<{ id: string; name: string; reason: string }> = [];
      const files = new Set<string>();

      for (const node of impactedTests) {
        const raw = node.attributes?.testRef;
        if (raw === undefined || raw === null) {
          const reason = node.attributes?.concept === true ? 'concept-only (no run artifact yet)' : 'no testRef attribute';
          unresolved.push({ id: node.uid, name: node.name, reason });
          continue;
        }
        const parsed = TestRefSchema.safeParse(raw);
        if (!parsed.success) {
          unresolved.push({ id: node.uid, name: node.name, reason: `invalid testRef: ${parsed.error.message}` });
          continue;
        }
        tests.push({ id: node.uid, name: node.name, testRef: parsed.data });
        files.add(parsed.data.file);
      }

      // Minimal selective run: ONLY the affected test files, sorted+deduped.
      const fileList = [...files].sort();
      const command = fileList.length > 0 ? `vitest run ${fileList.join(' ')}` : 'vitest run --passWithNoTests';

      return {
        command,
        tests,
        coverage: {
          changeSet: input.changeSet,
          impactedNodes: impacted.size,
          impactedTests: impactedTests.length,
          resolved: tests.length,
          files: fileList,
        },
        unresolved,
      };
    },
  };

  const graph_help: MCPTool<
    z.infer<typeof GraphHelpInputSchema>,
    HelpEntry | { measures: ContextualMeasure[] }
  > = {
    name: 'graph_help',
    description:
      'Explain any dashboard item for both audiences (CR-GC-229): a systems engineer who does not know ' +
      'this encoding, and a user with no SE background. Read-only. With `token` → the HelpEntry for that ' +
      'ruleId / gate / panel / artifact / vocabulary token, carrying all three layers (plain, SE-terms, ' +
      'and the exact copy-prompt). Without an argument → the contextual, ranked, explained measures from ' +
      'the live readiness + violations (the explained sibling of Recommendations), covering BOTH rule ' +
      'violations and not-done-creation gate blockers (CR-GC-221). Authored Plain/SE layers come from ' +
      'help-content.ts; titles/severity/owning-gate are derived from V3_RULES + readiness.',
    inputSchema: GraphHelpInputSchema,
    async handler(input) {
      if (input.token !== undefined) {
        const entry = helpEntry(input.token);
        if (!entry) {
          throw new Error(
            `graph_help: unknown token '${input.token}'. Try a ruleId (e.g. R-04), a gate (SRR/PDR/CDR/TRR, ` +
              `SAR/FCA/SVR/FRR), a panel (readiness/recommendations/artifacts/impact/health), an artifact ` +
              `(e.g. fmea), or a vocabulary token (e.g. REQ). Omit the token for contextual help.`,
          );
        }
        return entry;
      }
      return {
        measures: contextualHelp(scoreReadinessWithConformance(harness), [
          ...harness.evaluateRules(),
          ...conformanceViolations(harness),
        ]),
      };
    },
  };

  const graph_authoring_guide: MCPTool<
    z.infer<typeof GraphAuthoringGuideInputSchema>,
    {
      type: string;
      outgoing: Array<{ edgeType: string; targetType: string; cardinality?: string; description?: string }>;
      incoming: Array<{ edgeType: string; sourceType: string; cardinality?: string; description?: string }>;
      requiredAttrs: string[];
      formatEExample: string;
    }
  > = {
    name: 'graph_authoring_guide',
    description:
      'Surface the LEGAL incident edges for an ElementType (CR-GC-231) — the read-twin of graph_context for ' +
      'the WRITE side of the spec. graph_context answers "what is a node\'s definition-of-done" (implement); ' +
      'graph_authoring_guide answers "what structure is legal for this type" (author). Call it BEFORE writing ' +
      'a node so you emit a correct add-node/add-edge via graph_mutate instead of guessing the ontology. ' +
      'Returns outgoing [{edgeType,targetType,cardinality,description}], incoming [{edgeType,sourceType,…}], ' +
      'and requiredAttrs — derived live from the imported @sigloch/contracts/se META_MODEL (TRACE_PATTERNS), ' +
      'never a local fork. Read-only. Unknown type → a clear error. ' +
      'formatEExample (CR-GC-321) is a ready-to-paste Format-E block for this type: `+ uid|text` has only ' +
      'TWO positional fields (uid and DESCRIPTION) — the readable name travels as the `__name` attribute, ' +
      'inline `[__name:…]` or as an `@__name …` line when it contains a comma or a bracket. Without ' +
      '`__name` the uid silently becomes the name.',
    inputSchema: GraphAuthoringGuideInputSchema,
    async handler(input) {
      const descriptor = SE_DESCRIPTOR.nodeTypes[input.type as keyof typeof SE_DESCRIPTOR.nodeTypes];
      if (!descriptor) {
        throw new Error(
          `graph_authoring_guide: unknown element type '${input.type}'. Valid types: ` +
            `${Object.keys(SE_DESCRIPTOR.nodeTypes).join(', ')}.`,
        );
      }
      const patterns = TRACE_PATTERNS as ReadonlyArray<{
        source: string;
        target: string;
        type: string;
        cardinality?: string;
        description?: string;
      }>;
      const outgoing = patterns
        .filter((p) => p.source === input.type)
        .map((p) => ({ edgeType: p.type, targetType: p.target, cardinality: p.cardinality, description: p.description }));
      const incoming = patterns
        .filter((p) => p.target === input.type)
        .map((p) => ({ edgeType: p.type, sourceType: p.source, cardinality: p.cardinality, description: p.description }));
      return {
        type: input.type,
        outgoing,
        incoming,
        requiredAttrs: [...(descriptor.requiredAttrs ?? [])],
        formatEExample: formatEExampleFor(input.type),
      };
    },
  };

  return {
    rules_evaluate,
    rules_get_violations,
    graph_next_step,
    audit_trail,
    audit_stats,
    graph_readiness,
    graph_tests,
    graph_help,
    graph_authoring_guide,
  };
}
