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
 *   INCOSE-Artifact-Scope = LEAN, refined (CR-GC-226, supersedes the CR-GC-125
 *   `lean = no artifacts` stance). graphcode is a headless QM-level governance
 *   harness, not an ASIL-rated system. The graph is the SSOT and every RENDER
 *   (SRS/SDD/RTM/ICD/…) is a DETERMINISTIC PROJECTION of it (CR-GC-220) — not a
 *   separate hand-authored deliverable. CREATION artifacts (ConOps, FMEA,
 *   Assumption Review, Trade, Impl Plan) ARE in scope as lightweight judgment
 *   inputs and gate preconditions — tracked in the artifact tab (CR-GC-222) and
 *   required by the gates (CR-GC-221). Only ASIL-D-grade evidence (full FMEA
 *   S/O/D rigor, ASIL isolation proof) stays out of scope — graphcode carries no
 *   `asil`-rated elements. Refined model: docs/proposals/readiness-artifact-model.md §3.
 *
 *   Phase-Readiness — 4 INCOSE technical-review gates (SRR/PDR/CDR/TRR), each a
 *   DISJOINT + EXHAUSTIVE partition of the element-level V3_RULES. A gate is
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
import { CODE_CONFORMANCE_RULES } from '@sigloch/contracts/se';
import type { RuleViolation } from '@sigloch/contracts/harness';
import {
  scoreCompleteness,
  NEUTRAL_COMPLETENESS,
  type GateCompleteness,
  type CGraph,
} from './readiness-completeness.js';

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
 * `lean`  — graph = SSOT; renders are deterministic projections, creations are
 *           lightweight judgment inputs + gate preconditions (graphcode's stance,
 *           refined CR-GC-226). NOT "no artifacts".
 * `full`  — ASIL-D-grade evidence (full FMEA S/O/D rigor, ASIL isolation) (not graphcode).
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
  // valid trace patterns (R-18: every trace's element-type pair is legal — now also
  // flags any residual REQ→MOD allocate edge, CR-228), module allocation (R-22
  // FUNC→MOD, R-23 MOD→FUNC — CR-202/208), and FUNC→code binding — presence (R-20: every non-concept
  // FUNC carries a realRef, CR-GC-205 Item 5) AND resolution (RC-01: the realRef
  // points at a declared symbol on disk — CR-GC-253 conformance, with CodeFacts).
  // SCHEMA realRef binding (R-26 presence, RC-03 resolution, RC-04 parsed-at-interface —
  // CR-211) and physical-MOD realRef presence (R-27, CR-228) join the realRef family
  // (R-20/RC-01) here: interfaces + parts are detailed design.
  // RC-05 (cross-module import drift — CR-212) is module-coupling: also detailed design.
  CDR: ['R-03', 'R-04', 'R-12', 'R-18', 'R-20', 'R-22', 'R-23', 'R-26', 'R-27', 'RC-01', 'RC-03', 'RC-04', 'RC-05', 'RD-01', 'RD-02', 'RD-03'],
  // Verification wired (TEST→REQ) + referential trace consistency + runnable test
  // bindings — presence (R-19) AND resolution (RC-02: file + case exist, CR-GC-253).
  TRR: ['R-05', 'R-08', 'R-19', 'R-21', 'RC-02'],
};

/** Human labels for the phase gates. */
export const PHASE_GATE_LABELS: Record<string, string> = {
  SRR: 'System Requirements Review',
  PDR: 'Preliminary Design Review',
  CDR: 'Critical Design Review',
  TRR: 'Test Readiness Review',
};

/**
 * Creation artifacts each phase gate requires (CR-GC-221): the judgment work
 * ("rule-green ≠ analysis-done") a rule-clean structure cannot prove was ever
 * done. A gate is only `passed` if its required creations are 🟢-current.
 * TRR carries none (tests are inline in the graph, not a separate creation).
 */
export const PHASE_GATE_CREATIONS: Record<string, readonly string[]> = {
  SRR: ['conops', 'assumption-review'],
  PDR: ['fmea', 'trade'],
  CDR: ['implplan'],
  TRR: [],
};

/** Human labels for creation artifacts (used in blocking messages). */
const CREATION_LABELS: Record<string, string> = {
  conops: 'ConOps',
  'assumption-review': 'Assumption Review',
  fmea: 'FMEA',
  trade: 'Trade study',
  implplan: 'Impl plan',
};

/** Impl gate → the phase whose creations it inherits as an anti-vacuous-green precondition. */
export const IMPL_GATE_PHASE: Record<string, string> = {
  SAR: 'SRR',
  FCA: 'PDR',
  SVR: 'CDR',
  FRR: 'TRR',
};

/** Currency of a creation artifact: 🟢 current / 🟡 stale / 🔴 absent. */
export type CreationCurrency = 'current' | 'stale' | 'absent';

/**
 * Resolves whether a creation artifact is current/stale/absent (CR-GC-221 = the
 * INTERFACE; CR-GC-222's classifier supplies the real implementation). When no
 * provider is passed to `computeReadiness`, creation enforcement is OFF
 * (back-compat) — the gates still report their `creationArtifacts`, but currency
 * is not checked until 222 wires a provider in.
 */
export type CreationCurrencyProvider = (creation: string) => CreationCurrency;

/** Default stub provider (CR-GC-221, "Default 🔴"): everything absent until CR-GC-222 lands. */
export const ABSENT_CREATION_PROVIDER: CreationCurrencyProvider = () => 'absent';

/** Format a "<Creation> not performed (<gate> creation)" blocking message.
 *  Exported so the help layer (CR-GC-228) can identify creation blockers in
 *  `ReadinessGate.blocking[]` without re-deriving the format (single source). */
export function creationBlockingMsg(creation: string, gateId: string): string {
  return `${CREATION_LABELS[creation] ?? creation} not performed (${gateId} creation)`;
}

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
 * MS-02 dangling dependency). Together with the phase-gate rules these span
 * V3_RULES exhaustively — so the model covers it with nothing left over.
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
  /** Creation artifacts this gate requires (CR-GC-221) — judgment work, not rules. */
  creationArtifacts: string[];
  /**
   * Structural completeness of the derivation chain owned by this gate
   * (CR-GC-250) — orthogonal to violation severity. `covered/total` over the
   * DRIVING population, so absence counts (0 FCHAIN → all UCs incomplete → SRR
   * red). One value per gate for the dashboard; `missing[]` is the on-click
   * per-leg detail. A gate cannot pass while `covered < total`. Impl gates carry
   * a neutral `{0,0,[]}` (completeness is a phase-gate concept).
   */
  completeness: GateCompleteness;
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

  /**
   * Whether creation-artifact currency was ENFORCED in this report (CR-GC-259).
   * `off` means no `CreationCurrencyProvider` was supplied, so every gate's
   * `creationArtifacts` was REPORTED but never checked — a gate can read
   * `passed` with a never-performed FMEA/ConOps behind it. Made explicit because
   * a silently-unenforced gate is the same false-green class CR-GC-250 closed:
   * a consumer cannot distinguish "no creation blockers" from "not checked".
   * graphcode itself has no classifier yet (the real provider is fed by the
   * dashboard), so the product path reports `off` until one lands.
   */
  creationEnforcement: 'on' | 'off';

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
  const stripGate = (g: ReadinessGate): ReadinessGate => ({
    ...g,
    blocking: [],
    open: [],
    // Keep the one-value covered/total for the dashboard; drop the per-leg drill-down.
    completeness: { ...g.completeness, missing: [] },
  });
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

/**
 * Score one phase gate from the violations whose ruleId it owns, plus its
 * required creation artifacts (CR-GC-221): a gate is only `passed` if it is
 * rule-clean AND every required creation is 🟢-current. When `currency` is
 * undefined, creation enforcement is OFF (back-compat) — `creationArtifacts`
 * is still reported. Creations affect `passed`/`blocking`, not the rule `score`.
 */
function scorePhaseGate(
  id: string,
  ruleIds: readonly string[],
  violations: RuleViolation[],
  creations: readonly string[],
  graph: CGraph,
  currency?: CreationCurrencyProvider,
): ReadinessGate {
  const owned = violations.filter((v) => ruleIds.includes(v.ruleId));
  const errors = owned.filter((v) => v.severity === 'error');
  const rulesWithError = new Set(errors.map((v) => v.ruleId));
  const ruleBlocking = errors.map((v) => `${v.ruleId}: ${v.message}`);
  const open = owned.filter((v) => v.severity !== 'error').map((v) => `${v.ruleId}: ${v.message}`);
  // Phase gate requires every creation 🟢-current — stale OR absent blocks.
  const creationBlocking = currency
    ? creations.filter((c) => currency(c) !== 'current').map((c) => creationBlockingMsg(c, id))
    : [];
  // Structural completeness (CR-GC-250): one aggregated blocking line, not N warnings.
  const completeness = scoreCompleteness(id, graph);
  const complete = completeness.covered === completeness.total;
  const completenessBlocking = complete
    ? []
    : [`${id} completeness ${completeness.covered}/${completeness.total} — ${completeness.missing.join('; ')}`];
  const blocking = [...ruleBlocking, ...creationBlocking, ...completenessBlocking];
  // Maturity = share of the gate's hard checks with no error, floored by completeness coverage:
  // a gate cannot read green while a mandated chain leg is empty.
  const ruleScore = ruleIds.length > 0 ? (ruleIds.length - rulesWithError.size) / ruleIds.length : 1;
  const completenessRatio = completeness.total > 0 ? completeness.covered / completeness.total : 1;
  return {
    id,
    label: PHASE_GATE_LABELS[id] ?? id,
    passed: rulesWithError.size === 0 && creationBlocking.length === 0 && complete,
    score: Math.min(ruleScore, completenessRatio),
    blocking,
    open,
    creationArtifacts: [...creations],
    completeness,
  };
}

/**
 * Score one implementation gate from its milestone's CRs + scope (MS + status),
 * plus an anti-vacuous-green creation check (CR-GC-221): the gate additionally
 * blocks when a creation required by its phase is 🔴 **absent** — even with no
 * representing CR (a never-done FMEA must not pass silently). Only `absent`
 * blocks here (not `stale`); enforcement is off when `currency` is undefined.
 */
function scoreImplGate(
  id: string,
  ms: string,
  label: string,
  graph: Pick<Graph, 'nodes' | 'edges'>,
  elementsWithError: Set<string>,
  creations: readonly string[],
  currency?: CreationCurrencyProvider,
): ReadinessGate {
  const msNode = graph.nodes.find((n) => n.uid === ms);
  if (!msNode) {
    return {
      id,
      label,
      passed: false,
      score: 0,
      blocking: [`milestone ${ms} missing`],
      open: [],
      creationArtifacts: [...creations],
      completeness: NEUTRAL_COMPLETENESS,
    };
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

  // Anti-vacuous-green: a phase creation that is 🔴 absent blocks the impl gate
  // even when every CR is done and the scope is clean (the analysis was never done).
  const creationBlocking = currency
    ? creations.filter((c) => currency(c) === 'absent').map((c) => creationBlockingMsg(c, id))
    : [];
  const blocking = [
    ...openCrs.map((c) => `${c.uid} not done`),
    ...scopeErrors.map((id2) => `${id2} has an error-severity violation`),
    ...creationBlocking,
  ];
  const msStatus = msNode.attributes?.status;
  const score = crs.length > 0
    ? (crs.length - openCrs.length) / crs.length
    : msStatus === 'done' || msStatus === 'reviewed' ? 1 : 0;
  return { id, label, passed: blocking.length === 0, score, blocking, open: [], creationArtifacts: [...creations], completeness: NEUTRAL_COMPLETENESS };
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
  creationCurrency?: CreationCurrencyProvider,
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
    scorePhaseGate(id, ruleIds, violations, PHASE_GATE_CREATIONS[id] ?? [], graph, creationCurrency),
  );
  const implGates = Object.entries(IMPL_GATE_MILESTONES).map(([id, { ms, label }]) =>
    scoreImplGate(
      id,
      ms,
      label,
      graph,
      elementsWithError,
      PHASE_GATE_CREATIONS[IMPL_GATE_PHASE[id]] ?? [],
      creationCurrency,
    ),
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
    creationEnforcement: creationCurrency ? 'on' : 'off',
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
 * The authoritative set of family rule-IDs (derived at runtime from
 * SE_DESCRIPTOR — the graph rules — plus the contracts RC conformance rules
 * (CR-GC-253); never hardcoded here). Exposed for test assertions and
 * dashboard consumers.
 */
export function getFamilyRuleIds(): Set<string> {
  return new Set([
    ...(SE_DESCRIPTOR.rules ?? []).map((r) => r.id),
    ...CODE_CONFORMANCE_RULES.map((r) => r.id),
  ]);
}
