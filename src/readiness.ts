/**
 * ReadinessScorer — CR-GC-107 (compliance) + CR-GC-125 (readiness model).
 *
 * Computes readiness for a graphcode graph purely from `@sigloch/contracts`
 * V3_RULES violations (via `harness.evaluateRules()`, the L2 gate — see
 * FCHAIN-apply-gate) PLUS the MS milestone nodes and element status. This is
 * the in-repo deliverable that proves readiness is measured against the FAMILY
 * rule base, NOT the aimprove predecessor rules (BQ-2.0.0 / INCOSE-style
 * BQ-06/BQ-02). The foreign BQ path is explicitly NOT used; it is removed from
 * family readiness scoring.
 *
 * REQ-readiness-model (CR-GC-125) — the model, defined here AND in the graph:
 *
 *   INCOSE-Artifact-Scope = LEAN. graphcode is a headless QM-level governance
 *   harness, not an ASIL-rated system. The governed graph IS the single SE
 *   artifact (REQ = requirements baseline, MOD/FUNC/allocate = design,
 *   TEST/verify = verification); there are no separate document deliverables
 *   (SRS/SDD/STP), and full-scope artifacts (FMEA S/O/D, ASIL-D isolation
 *   evidence) are out of scope — graphcode carries no `asil`-rated elements.
 *
 *   Phase-Readiness — 4 INCOSE technical-review gates (SRR/PDR/CDR/TRR), each a
 *   DISJOINT + EXHAUSTIVE partition of the 15 element-level V3_RULES. A gate is
 *   `passed` iff none of its rules fire an error-severity violation; warnings/
 *   info are advisory (`open`). The four gates collectively == element
 *   compliance, so nothing is measured outside V3_RULES.
 *
 *   Implementation-Readiness — 4 program/build acceptance gates
 *   (SAR/FCA/SVR/FRR), each bound to a milestone tier (MS-1..MS-4). A gate is
 *   `ready` iff every CR assigned to its milestone (CR -relation-> MS) is
 *   status=done AND the milestone scope (MS -compose-> X) carries no
 *   error-severity violation. Derived from the MS nodes + element status, i.e.
 *   the MS-01/MS-02 milestone-rule concerns — the remaining 2 of the 17 rules.
 *
 * Host/dashboard wiring (panels) lives in MOD-dashboard (CR-GC-115); this module
 * provides the scoring primitive only — no dashboard, no renderer.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph } from '@sigloch/graph-api-core';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';

// ---------------------------------------------------------------------------
// Compliance dimension (CR-GC-107)
// ---------------------------------------------------------------------------

/**
 * A readiness dimension score in [0, 1].
 * 0 = fully non-compliant, 1 = fully compliant.
 */
export interface ReadinessDimension {
  /** Score in [0, 1]. */
  score: number;
  /** Short human-readable label for display. */
  label: string;
  /** How many elements were evaluated. */
  totalElements: number;
  /** How many elements carry at least one error-severity violation. */
  elementsWithErrors: number;
}

// ---------------------------------------------------------------------------
// Readiness model (CR-GC-125) — phase gates, impl gates, INCOSE scope.
// The model is data, derived ONLY from V3_RULES + MS + status. No BQ heuristic.
// ---------------------------------------------------------------------------

/**
 * INCOSE artifact scope for the system under governance.
 * `lean`  — the graph is the single SE artifact (graphcode's stance).
 * `full`  — separate document deliverables + ASIL/FMEA evidence (not graphcode).
 */
export type IncoseScope = 'lean' | 'full';

/** graphcode's declared scope — see the module header for the rationale. */
export const GRAPHCODE_INCOSE_SCOPE: IncoseScope = 'lean';

/**
 * Phase-Readiness gates (INCOSE technical reviews) → the element-level V3_RULES
 * each gate owns. DISJOINT + EXHAUSTIVE over the 15 element rules; verified by
 * TEST-readiness-model against SE_DESCRIPTOR at runtime (never hardcoded count).
 */
export const PHASE_GATE_RULES: Record<string, readonly string[]> = {
  // System + use-case structure exists; every requirement is verifiable.
  SRR: ['R-17', 'R-14', 'R-01'],
  // Functional architecture: chains, actors, flows; functions trace to REQs.
  PDR: ['R-15', 'R-16', 'R-10', 'R-02'],
  // Detailed design: ASIL isolation, module size, no cycles, sound decomposition,
  // valid trace patterns (R-18: every trace's element-type pair is legal), and
  // FUNC→code binding (R-20: every non-concept FUNC carries a codeRef — CR-GC-205 Item 5).
  CDR: ['R-03', 'R-04', 'R-12', 'R-18', 'R-20', 'RD-01', 'RD-02', 'RD-03'],
  // Verification wired (TEST→REQ) + referential trace consistency + runnable test
  // bindings (R-19: every non-concept TEST carries a testRef).
  TRR: ['R-05', 'R-08', 'R-19'],
};

/** Human labels for the phase gates. */
export const PHASE_GATE_LABELS: Record<string, string> = {
  SRR: 'System Requirements Review',
  PDR: 'Preliminary Design Review',
  CDR: 'Critical Design Review',
  TRR: 'Test Readiness Review',
};

/**
 * Implementation-Readiness gates (program/build acceptance) → milestone tier.
 * Ready iff every CR assigned to the MS is done + the MS scope is error-clean.
 */
export const IMPL_GATE_MILESTONES: Record<string, { ms: string; label: string }> = {
  SAR: { ms: 'MS-1-specification', label: 'System Acceptance Review' },
  FCA: { ms: 'MS-2-coding-vv', label: 'Functional Configuration Audit' },
  SVR: { ms: 'MS-3-mvp-readiness', label: 'System Verification Review' },
  FRR: { ms: 'MS-4-mvp2', label: 'Functional Readiness Review' },
};

/**
 * The 2 milestone-level V3_RULES the impl gates embody (MS-01 empty scope,
 * MS-02 dangling dependency). Together with the 15 phase-gate rules these are
 * the full 17 — so the model spans V3_RULES with nothing left over.
 */
export const IMPL_GATE_RULES: readonly string[] = ['MS-01', 'MS-02'];

/**
 * A single readiness gate outcome.
 * `passed` is the hard verdict (no blocking/error item); `score` ∈ [0,1] is a
 * continuous maturity indicator; `open` items are advisory (warnings/CR debt).
 */
export interface ReadinessGate {
  /** Gate id — SRR/PDR/CDR/TRR (phase) or SAR/FCA/SVR/FRR (impl). */
  id: string;
  /** Human-readable review name. */
  label: string;
  /** True iff no blocking (error-severity / not-done) item remains. */
  passed: boolean;
  /** Continuous maturity in [0, 1]. */
  score: number;
  /** Blocking items that hold the gate closed (errors / open CRs / scope errors). */
  blocking: string[];
  /** Advisory items surfaced but not blocking (warnings, info, scope notes). */
  open: string[];
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/**
 * Full readiness snapshot derived from V3_RULES evaluation + MS + status.
 * All violation ruleIds are contracts rule-IDs (R-xx / RD-xx / MS-xx) — never BQ-*.
 */
export interface ReadinessReport {
  /**
   * Compliance dimension: fraction of graph elements with NO error-severity
   * violation. 1.0 = all elements clean, 0.0 = all elements have ≥1 error.
   */
  compliance: ReadinessDimension;

  /** Declared INCOSE artifact scope for this system (graphcode = `lean`). */
  incoseScope: IncoseScope;

  /** Phase-Readiness gates (INCOSE technical reviews) in lifecycle order. */
  phaseGates: ReadinessGate[];

  /** Implementation-Readiness gates (program/build acceptance) in tier order. */
  implGates: ReadinessGate[];

  /**
   * Per-contracts-rule-ID violation counts. Keys are exactly the
   * `SE_DESCRIPTOR.rules` members that fired. Foreign BQ-* IDs cannot appear —
   * the scorer delegates exclusively to the V3 rule engine.
   */
  violationsByRule: Record<string, number>;

  /** All raw violations, ordered by severity (error → warning → info). */
  violations: RuleViolation[];

  /** Timestamp (ISO 8601) when this report was computed. */
  computedAt: string;
}

/**
 * Summary projection of a ReadinessReport (CR-GC-203 item 2): drops the heavy
 * per-element lists — `violations` and every gate's `blocking`/`open` — while
 * keeping scores, counts and `violationsByRule`. `graph_readiness` returns this
 * by default; `detail:true` returns the full lists. On a fully-red graph the
 * full report inlined every blocking element (86k+ chars, past the MCP tool
 * result limit) forcing a file-spill; the summary stays small.
 */
export function summarizeReadiness(report: ReadinessReport): ReadinessReport {
  const stripGate = (g: ReadinessGate): ReadinessGate => ({ ...g, blocking: [], open: [] });
  return {
    ...report,
    phaseGates: report.phaseGates.map(stripGate),
    implGates: report.implGates.map(stripGate),
    violations: [],
  };
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

/** Group violations by element-id for per-element error lookups. */
function elementsWithErrorSet(violations: RuleViolation[]): Set<string> {
  return new Set<string>(
    violations
      .filter((v) => v.severity === 'error' && v.elementId !== undefined)
      .map((v) => v.elementId as string),
  );
}

/** Score one phase gate from the violations whose ruleId it owns. */
function scorePhaseGate(id: string, ruleIds: readonly string[], violations: RuleViolation[]): ReadinessGate {
  const owned = violations.filter((v) => ruleIds.includes(v.ruleId));
  const errors = owned.filter((v) => v.severity === 'error');
  const rulesWithError = new Set(errors.map((v) => v.ruleId));
  const blocking = errors.map((v) => `${v.ruleId}: ${v.message}`);
  const open = owned.filter((v) => v.severity !== 'error').map((v) => `${v.ruleId}: ${v.message}`);
  // Maturity = share of the gate's hard checks (its rules) with no error.
  const score = ruleIds.length > 0 ? (ruleIds.length - rulesWithError.size) / ruleIds.length : 1;
  return { id, label: PHASE_GATE_LABELS[id] ?? id, passed: rulesWithError.size === 0, score, blocking, open };
}

/** Score one implementation gate from its milestone's CRs + scope (MS + status). */
function scoreImplGate(
  id: string,
  ms: string,
  label: string,
  graph: Pick<Graph, 'nodes' | 'edges'>,
  elementsWithError: Set<string>,
): ReadinessGate {
  const msNode = graph.nodes.find((n) => n.uid === ms);
  if (!msNode) {
    return { id, label, passed: false, score: 0, blocking: [`milestone ${ms} missing`], open: [] };
  }
  const nodeById = new Map(graph.nodes.map((n) => [n.uid, n]));
  // CRs assigned to this milestone: CR -relation-> MS (the MS-01 scope semantics).
  const crs = graph.edges
    .filter((e) => e.edgeType === 'relation' && e.targetId === ms)
    .map((e) => nodeById.get(e.sourceId))
    .filter((n): n is NonNullable<typeof n> => !!n && n.type === 'CR');
  const openCrs = crs.filter((c) => c.attributes?.status !== 'done');
  // Milestone scope: composed elements (MS -compose-> X) must be error-clean.
  const scopeErrors = graph.edges
    .filter((e) => e.sourceId === ms && e.edgeType === 'compose')
    .map((e) => e.targetId)
    .filter((id2) => elementsWithError.has(id2));

  const blocking = [
    ...openCrs.map((c) => `${c.uid} not done`),
    ...scopeErrors.map((id2) => `${id2} has an error-severity violation`),
  ];
  const msStatus = msNode.attributes?.status;
  const score = crs.length > 0
    ? (crs.length - openCrs.length) / crs.length
    : msStatus === 'done' || msStatus === 'reviewed' ? 1 : 0;
  return { id, label, passed: blocking.length === 0, score, blocking, open: [] };
}

/**
 * Compute readiness from a violations array + the full graph (nodes + edges).
 *
 * @param violations - from `harness.evaluateRules()` (contracts V3 rule IDs)
 * @param graph      - from `harness.getGraph()` (elements + traces)
 */
export function computeReadiness(
  violations: RuleViolation[],
  graph: Pick<Graph, 'nodes' | 'edges'>,
): ReadinessReport {
  const totalElements = graph.nodes.length;
  const elementsWithError = elementsWithErrorSet(violations);
  const elementsWithErrors = elementsWithError.size;
  const complianceScore = totalElements > 0 ? (totalElements - elementsWithErrors) / totalElements : 1;

  // Violation counts keyed by contracts rule-ID (never BQ-*).
  const violationsByRule: Record<string, number> = {};
  for (const v of violations) {
    violationsByRule[v.ruleId] = (violationsByRule[v.ruleId] ?? 0) + 1;
  }

  // Sort: error → warning → info.
  const severityRank: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const sorted = [...violations].sort(
    (a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3),
  );

  const phaseGates = Object.entries(PHASE_GATE_RULES).map(([id, ruleIds]) =>
    scorePhaseGate(id, ruleIds, violations),
  );
  const implGates = Object.entries(IMPL_GATE_MILESTONES).map(([id, { ms, label }]) =>
    scoreImplGate(id, ms, label, graph, elementsWithError),
  );

  return {
    compliance: {
      score: complianceScore,
      label: 'Compliance (V3_RULES, error-severity)',
      totalElements,
      elementsWithErrors,
    },
    incoseScope: GRAPHCODE_INCOSE_SCOPE,
    phaseGates,
    implGates,
    violationsByRule,
    violations: sorted,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Convenience wrapper: runs `evaluateRules()` + `getGraph()` on the harness
 * and returns the full ReadinessReport.
 *
 * Accepts a minimal harness-duck-type so callers can pass `GraphCodeHarness`
 * directly without importing its class (avoids circular dep risk in consumers).
 */
export function scoreReadiness(harness: {
  evaluateRules(): RuleViolation[];
  getGraph(): Pick<Graph, 'nodes' | 'edges'>;
}): ReadinessReport {
  const violations = harness.evaluateRules();
  const graph = harness.getGraph();
  return computeReadiness(violations, graph);
}

/**
 * The authoritative set of family rule-IDs (derived from SE_DESCRIPTOR at
 * runtime — the single source of truth, never hardcoded here).
 * Exposed for test assertions and dashboard consumers.
 */
export function getFamilyRuleIds(): Set<string> {
  return new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
}
