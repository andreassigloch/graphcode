/**
 * ReadinessScorer — CR-GC-107: Dashboard/Ontology Adoption Readiness.
 *
 * Computes readiness DIMENSIONS for a graphcode graph purely from
 * `@sigloch/contracts` V3_RULES violations as returned by
 * `harness.evaluateRules()` (L2 gate — see FCHAIN-apply-gate). This is the
 * in-repo deliverable that proves compliance is measured against the FAMILY
 * rule base, NOT the aimprove predecessor rules (BQ-2.0.0 / INCOSE-style
 * BQ-06/BQ-02).  The foreign BQ path is explicitly NOT used here; it is
 * removed from family compliance scoring.
 *
 * Host/dashboard wiring lives OUTSIDE this repo (aimprove predecessor).
 * This module provides the scoring primitive only — no dashboard, no renderer.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph } from '@sigloch/graph-api-core';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';

// ---------------------------------------------------------------------------
// Types
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

/**
 * Full readiness snapshot derived from V3_RULES evaluation.
 * All violation ruleIds are contracts rule-IDs (R-xx / RD-xx) — never BQ-*.
 */
export interface ReadinessReport {
  /**
   * Compliance dimension: fraction of graph elements with NO error-severity
   * violation.  1.0 = all elements clean, 0.0 = all elements have at least
   * one error.
   */
  compliance: ReadinessDimension;

  /**
   * Per-contracts-rule-ID violation counts.
   * Keys are exactly `SE_DESCRIPTOR.rules.map(r => r.id)` members that fired.
   * Foreign BQ-* rule IDs cannot appear here because the scorer delegates
   * exclusively to `harness.evaluateRules()` / the V3 rule engine.
   */
  violationsByRule: Record<string, number>;

  /**
   * All raw violations from `harness.evaluateRules()`, ordered by severity
   * (error → warning → info).
   */
  violations: RuleViolation[];

  /** Timestamp (ISO 8601) when this report was computed. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

/**
 * Compute readiness from a violations array + graph element count.
 *
 * Accepts the outputs of `harness.evaluateRules()` and `harness.getGraph()`
 * directly so callers may cache the results without re-running the engine.
 *
 * @param violations - from `harness.evaluateRules()` (contracts V3 rule IDs)
 * @param graph      - from `harness.getGraph()` (element count denominator)
 */
export function computeReadiness(
  violations: RuleViolation[],
  graph: Pick<Graph, 'nodes'>,
): ReadinessReport {
  const totalElements = graph.nodes.length;

  // Build per-element error set.
  const elementsWithError = new Set<string>(
    violations
      .filter((v) => v.severity === 'error' && v.elementId !== undefined)
      .map((v) => v.elementId as string),
  );

  const elementsWithErrors = elementsWithError.size;
  const cleanElements = totalElements - elementsWithErrors;
  const complianceScore = totalElements > 0 ? cleanElements / totalElements : 1;

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

  return {
    compliance: {
      score: complianceScore,
      label: 'Compliance (V3_RULES, error-severity)',
      totalElements,
      elementsWithErrors,
    },
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
  getGraph(): Pick<Graph, 'nodes'>;
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
