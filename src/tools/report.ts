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
import type { GraphNode, AuditEntry } from '@sigloch/graph-api-core';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import { TestRefSchema, type TestRef, TRACE_PATTERNS } from '@sigloch/contracts/se';
import { summarizeReadiness, type ReadinessReport } from '../readiness.js';
import { scoreReadinessWithConformance, conformanceViolations } from '../conformance.js';
import { helpEntry, contextualHelp, type HelpEntry, type ContextualMeasure } from '../viewer/help.js';
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
});

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
      return nextStep(harness.getGraph());
    },
  };

  const audit_trail: MCPTool<z.infer<typeof AuditTrailInputSchema>, { entries: AuditEntry[] }> = {
    name: 'audit_trail',
    description: 'Return mutation history entries from the audit log.',
    inputSchema: AuditTrailInputSchema,
    async handler(input) {
      const entries = await auditLog.query({
        consumerId: input.consumerId,
        since: input.since,
        limit: input.limit,
      });
      return { entries };
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

  const graph_readiness: MCPTool<
    z.infer<typeof GraphReadinessInputSchema>,
    ReadinessReport & { graphVersion: number }
  > = {
    name: 'graph_readiness',
    description:
      'Score family readiness of the live governed graph (FUNC-score-readiness / CR-GC-107 + CR-GC-125). ' +
      'Returns the ReadinessReport: compliance dimension (fraction of elements with no error-severity ' +
      'violation); incoseScope (graphcode = lean); phaseGates SRR/PDR/CDR/TRR (INCOSE technical reviews, ' +
      'a disjoint partition of the element-level V3_RULES); implGates SAR/FCA/SVR/FRR (milestone tiers ' +
      'MS-1..4, ready iff assigned CRs are done + scope error-clean); violationsByRule (keyed by contracts ' +
      'rule-ID — R-/RD-/MS-, never BQ-*); and computedAt. By DEFAULT returns a summary (no raw ' +
      'violations, no per-gate blocking/open lists) so it stays within the MCP result limit even on a ' +
      'fully-red graph; pass detail:true for the full lists. Read-only; derived ' +
      'from harness.evaluateRules() (L2 gate) + RC code-conformance (CR-GC-253: realRef/testRef ' +
      'resolved against the real source tree) + the MS nodes + element status.',
    inputSchema: GraphReadinessInputSchema,
    async handler(input) {
      const report = scoreReadinessWithConformance(harness);
      return { ...(input.detail ? report : summarizeReadiness(report)), graphVersion: graphVersion() };
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
      'never a local fork. Read-only. Unknown type → a clear error.',
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
      return { type: input.type, outgoing, incoming, requiredAttrs: [...(descriptor.requiredAttrs ?? [])] };
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
