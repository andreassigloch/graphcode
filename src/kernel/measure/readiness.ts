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
  GATE_STATES,
  GATE_STATE_LABELS,
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
  unposedLegs,
  type GateState,
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
import { z } from 'zod/v4';
import { RULE_TO_PHASE, PhaseGate, ruleApplies, type PhaseGateType } from '@sigloch/contracts/se';
import { GATE_STATES, unposedLegs, type CGraph, type GateState } from '@sigloch/graphcode-client';
import { toOntologyGraph } from '../conformance.js';

/** INCOSE technical-review gates, in lifecycle order — the Handoff precondition
 * walks this order to find the "current" (first incomplete) gate. */
export const PHASE_GATE_ORDER: readonly PhaseGateType[] = PhaseGate.options;

/**
 * One phase-gate's rule coverage (CR-GC-296).
 *
 * Zod (SCHEMA-phase-readiness), damit der Vertrag maschinell prüfbar ist statt
 * nur compile-time: die Liste reist als `GenerationStep.phaseReadiness` über
 * MCP-stdio und wird beim Executor mit dem GenerationStep zusammen geparst.
 */
export const PhaseGateReadiness = z.object({
  gate: PhaseGate,
  /** Rules mapped to this gate with NO open violation (any severity). */
  covered: z.number().int().nonnegative(),
  /** Total distinct rule IDs RULE_TO_PHASE maps to this gate AND that apply to the graph (CR-GC-695). */
  total: z.number().int().nonnegative(),
  /** Rule IDs mapped to this gate that still carry ≥1 open violation, sorted. */
  missing: z.array(z.string()),
  /**
   * CR-GC-745: der Zustand dieser Achse, im Vokabular des Gates (`GATE_STATES`, graphcode-client):
   * `open` = `missing` nicht leer · `not-reached` = keine gestellte Regel offen, aber ein
   * Vollstaendigkeits-Bein des Gates ist an diesem Graphen nicht gestellt (`unposedLegs`; heute TRR
   * vor Beginn der Realisierung) · `passed` sonst. `covered === total` allein ist KEIN Urteil: im
   * Entwurf liest TRR 8/8, weil 3 seiner 11 Regeln nicht gefragt sind. Anzeigetext: `GATE_STATE_LABELS`.
   */
  state: z.enum(GATE_STATES),
});
export type PhaseGateReadiness = z.infer<typeof PhaseGateReadiness>;

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
 * FLOW) that a dimension's ratio SCORE dilutes away over many elements.
 *
 * CR-GC-695: eine Regel, deren Vorbedingung der Graph nicht erfuellt (contracts `ruleApplies`,
 * `RULE_PRECONDITION`), ist NICHT GESTELLT — sie steht weder im Zaehler noch im Nenner; sonst
 * laese sich ihr Schweigen als bestanden. Seit CR-SM-392 ist die Vorbedingung ein Zustand des
 * Graphen, keine Typzaehlung: die Bindungsregeln R-19/R-20/R-26/RC-10 sind erst gestellt, wenn die
 * Realisierung begonnen hat (Bauplan-Stempel oder eine erste Bindung). Dieselbe Tabelle wie im
 * contracts-Nenner der Dimensionen — kein zweiter Vorbedingungs-Katalog hier (CR-GC-743).
 *
 * CR-GC-745: „nicht gestellt" ist damit aus dem Nenner — aber nicht aus dem Urteil. Ob dem Gate
 * etwas fehlt, das nicht gefragt wurde, sagt `unposedLegs` aus graphcode-client: dieselbe Funktion,
 * aus der `phaseGates[].state` entsteht (CR-SM-394), hier nur gelesen. Deshalb nimmt die Funktion
 * den Graphen in der Form des Stores — die Form, die `unposedLegs` liest. */
export function computePhaseReadiness(
  violations: readonly PhaseRuleHit[],
  graph: CGraph,
): PhaseGateReadiness[] {
  const og = toOntologyGraph(graph);
  const openRuleIds = new Set(violations.map((v) => v.ruleId));
  return PHASE_GATE_ORDER.map((gate) => {
    const ruleIds = Object.keys(RULE_TO_PHASE).filter((id) => RULE_TO_PHASE[id] === gate && ruleApplies(id, og));
    const missing = ruleIds.filter((id) => openRuleIds.has(id)).sort();
    const state: GateState = missing.length > 0 ? 'open' : unposedLegs(gate, graph).length > 0 ? 'not-reached' : 'passed';
    return { gate, total: ruleIds.length, covered: ruleIds.length - missing.length, missing, state };
  });
}

/** First gate in SRR→PDR→CDR→TRR order that is not `passed`, or `null` when all four
 * are — the Handoff precondition (CR-GC-296): "welches Gate 'aktuell' ist, folgt aus dem
 * ersten unvollständigen in der Reihenfolge". CR-GC-745: ein nicht durchschrittenes Gate
 * (`not-reached`) ist das aktuelle — die Leiter laeuft im Entwurf nicht ueber TRR hinaus. */
export function currentPhaseGate(phaseReadiness: readonly PhaseGateReadiness[]): PhaseGateType | null {
  for (const gate of PHASE_GATE_ORDER) {
    const found = phaseReadiness.find((p) => p.gate === gate);
    if (found && found.state !== 'passed') return gate;
  }
  return null;
}
