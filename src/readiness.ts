/**
 * ReadinessScorer — re-export shim (CR-GC-265).
 *
 * The readiness projection MOVED to `@sigloch/graphcode-client`. It is a pure
 * function of (violations, graph): plain data in, a report out — it never
 * touches the store, the gate or a process, which is exactly the boundary that
 * decides what may live outside the substrate.
 *
 * `scoreReadiness` still takes a harness-shaped argument, but only structurally
 * (`evaluateRules()` + `getGraph()`), so it carries no dependency on graphcode
 * either.
 *
 * This file keeps `./readiness.js` resolving so src and tests stay untouched.
 * ONE implementation — the client package's — no copy behind this door.
 *
 * @author andreas@siglochconsulting
 */
export {
  GRAPHCODE_INCOSE_SCOPE,
  PHASE_GATE_RULES,
  PHASE_GATE_LABELS,
  PHASE_GATE_CREATIONS,
  IMPL_GATE_PHASE,
  IMPL_GATE_MILESTONES,
  IMPL_GATE_RULES,
  ABSENT_CREATION_PROVIDER,
  creationBlockingMsg,
  summarizeReadiness,
  computeReadiness,
  scoreReadiness,
  getFamilyRuleIds,
  type IncoseScope,
  type CreationCurrency,
  type CreationCurrencyProvider,
  type ReadinessDimension,
  type ReadinessGate,
  type ReadinessReport,
} from '@sigloch/graphcode-client';

// ---------------------------------------------------------------------------
// phase_readiness (CR-GC-296) — NOT a re-export: RULE_TO_PHASE consumption at
// rule-coverage granularity doesn't exist in the client package. Orthogonal to
// the re-exported `phaseGates[].completeness` above (CR-GC-250's structural
// derivation-chain legs, e.g. "how many FCHAINs have ≥1 FUNC"): this counts
// RULE_TO_PHASE-mapped RULE IDs with zero open violations (any severity) vs.
// the total mapped to that gate — the same "group the rule-violation stream by
// an imported rule→X map" pattern RULE_TO_DIMENSION already uses in
// generate.ts/steering.ts, just keyed by phase gate instead of topic dimension.
// ---------------------------------------------------------------------------
import { RULE_TO_PHASE, PhaseGate, type PhaseGateType } from '@sigloch/contracts/se';

/** INCOSE technical-review gates, in lifecycle order — the Handoff precondition
 * walks this order to find the "current" (first incomplete) gate. */
export const PHASE_GATE_ORDER: readonly PhaseGateType[] = PhaseGate.options;

/** One phase-gate's rule coverage (CR-GC-296). */
export interface PhaseGateReadiness {
  gate: PhaseGateType;
  /** Rules mapped to this gate with NO open violation (any severity). */
  covered: number;
  /** Total distinct rule IDs RULE_TO_PHASE maps to this gate. */
  total: number;
  /** Rule IDs mapped to this gate that still carry ≥1 open violation, sorted. */
  missing: string[];
}

/** Minimal violation shape phase_readiness needs. Every violation stream in this
 * repo carries a rule id — camelCase `ruleId` (`@sigloch/contracts/harness`
 * RuleViolation, graph_readiness's stream) or snake_case `rule_id`
 * (`@sigloch/contracts/se`, generate.ts's family-catalog stream) — callers
 * normalize to this shape once instead of phase_readiness knowing both. */
export interface PhaseRuleHit {
  ruleId: string;
}

/** SRR/PDR/CDR/TRR covered/total + missing legs, derived from the rule
 * violation stream + RULE_TO_PHASE (CR-GC-296). A rule counts as "covered"
 * when it currently fires NO violation of any severity — stricter than
 * error-only `blockingErrors`, by design: a gate can be error-free yet still
 * carry warning-level structural gaps (e.g. R-15 empty FCHAIN, R-10 missing
 * FLOW) that a dimension's ratio SCORE dilutes away over many elements. */
export function computePhaseReadiness(violations: readonly PhaseRuleHit[]): PhaseGateReadiness[] {
  const openRuleIds = new Set(violations.map((v) => v.ruleId));
  return PHASE_GATE_ORDER.map((gate) => {
    const ruleIds = Object.keys(RULE_TO_PHASE).filter((id) => RULE_TO_PHASE[id] === gate);
    const missing = ruleIds.filter((id) => openRuleIds.has(id)).sort();
    return { gate, total: ruleIds.length, covered: ruleIds.length - missing.length, missing };
  });
}

/** First gate in SRR→PDR→CDR→TRR order that is not fully covered, or `null`
 * when all four are — the Handoff precondition (CR-GC-296): "welches Gate
 * 'aktuell' ist, folgt aus dem ersten unvollständigen in der Reihenfolge". */
export function currentPhaseGate(phaseReadiness: readonly PhaseGateReadiness[]): PhaseGateType | null {
  for (const gate of PHASE_GATE_ORDER) {
    const found = phaseReadiness.find((p) => p.gate === gate);
    if (found && found.covered < found.total) return gate;
  }
  return null;
}
