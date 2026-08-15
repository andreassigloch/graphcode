/**
 * CR-GC / CR-223 (ST-5): "next best step" steering adapter.
 *
 * Read-only. Condenses the full advisory rule set into ONE causally-grounded
 * action: highest readiness-deficit dimension → the rules firing in it → a
 * concrete next action. Uses the shared deterministic steering core
 * (@sigloch/se-steering), NOT the aimpro Suggestion/learning layer.
 *
 * The GATE (rules_get_violations / graph_readiness) stays authoritative for
 * pass/fail. This tool only prioritises what to do next.
 */
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation, MetricPolicy } from '@sigloch/contracts/se';
import { RULE_TO_DIMENSION } from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from './steering-snapshot.js';

/** Generic next action per readiness dimension. */
const DIMENSION_ACTION: Record<string, string> = {
  req: 'Sharpen requirements — add verification, resolve ambiguity/placeholders',
  uc: 'Complete use cases — add requirements, actors, scenarios (compose/io)',
  arch: 'Fix functional architecture — satisfy REQ, wire FLOWs, break cycles',
  alloc: 'Allocate functions to modules (allocate FUNC→MOD traces)',
  ver: 'Add verification — TEST→verify→REQ with results',
  schema: 'Complete schemas — definitions + FLOW references',
  cr: 'Trace change requests — relation→FUNC/MOD + commit refs',
  ms: 'Plan milestones — scope + dependencies',
};

export interface NextStepResult {
  /** Error-severity violations (gate blockers). */
  blocking: { errors: number; ruleIds: string[] };
  /** The single highest-leverage next action, or null when release-ready. */
  nextStep: {
    dimension: string;
    deficit: number;
    clears: string[]; // e.g. "R-22 x4"
    action: string;
    why: string;
  } | null;
  /** Lower-priority findings to address after the gate. */
  advisory: { rule_id: string; count: number }[];
  // CR-GC-336: `weights` (D1–D6) ist gestrichen. Der Vektor wurde ausgegeben, aber niemand
  // handelte auf ihm — er gewichtete keinen Kandidaten und verschob keine Auswahl (CR-SM-237).
  // Die Fokus-Dimension steht in `nextStep`; der Vektor war nur eine zweite Darstellung davon.
}

/** Group violations into `"RULE xN"` labels, highest count first. */
function countByRule(violations: RuleViolation[]): { rule_id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of violations) counts.set(v.rule_id, (counts.get(v.rule_id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([rule_id, count]) => ({ rule_id, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute the "next best step" for the current graph.
 * Deterministic: readiness → top-deficit dimension → firing rules.
 */
export function nextStep(graph: Graph, policy: MetricPolicy, focusThreshold: number): NextStepResult {
  // CR-GC-324: EINE Graph→OntologyGraph-Abbildung. Vorher stand hier eine lokale
  // Kopie über `JSON.parse(exportGraphJson(graph))` — das flache Export-Encoding
  // (CR-216/219) versteckt `attributes.*`, wodurch R-19/R-20/R-26/VR-01/AF-01..05
  // in DIESEM Pfad scheinfeuerten und damit die Dimensions-Priorisierung
  // verschoben. Der Snapshot (CR-GC-303/289) ist der eine Messpfad; er trägt die
  // ND-Injektion (CR-GC-287) bereits.
  const { violations, report } = takeSteeringSnapshot(graph, policy, focusThreshold);

  const errors = violations.filter((v) => v.severity === 'error');
  const blocking = {
    errors: errors.length,
    ruleIds: [...new Set(errors.map((v) => v.rule_id))],
  };

  // Pick the readiness dimension with the highest deficit that has actionable
  // violations (lowest score, tie-broken by violation count). This is the
  // direct signal for "what to fix next"; the weight vector is the finer D1–D6
  // guidance surfaced alongside.
  const top = report.scores
    .filter((s) => s.applicable > 0 && s.violations > 0)
    .sort((a, b) => a.score - b.score || b.violations - a.violations)[0];

  let step: NextStepResult['nextStep'] = null;
  if (top) {
    const dimViolations = violations.filter((v) => RULE_TO_DIMENSION[v.rule_id] === top.dimension);
    step = {
      dimension: top.dimension,
      deficit: Math.round((1 - top.score) * 1000) / 1000,
      clears: countByRule(dimViolations).map(({ rule_id, count }) => `${rule_id} x${count}`),
      action: DIMENSION_ACTION[top.dimension] ?? 'Address the highest-deficit dimension',
      why: `${top.dimension} readiness is the lowest with actionable findings (score ${top.score}); clearing these advances the gate the most`,
    };
  }

  // Advisory = remaining non-error findings outside the chosen dimension.
  const advisory = countByRule(
    violations.filter((v) => v.severity !== 'error' && (!top || RULE_TO_DIMENSION[v.rule_id] !== top.dimension)),
  );

  return { blocking, nextStep: step, advisory };
}
