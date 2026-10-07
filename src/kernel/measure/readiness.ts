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
 * CR-GC-748 (contracts 11 / client 2, CR-SM-395): the marks SRR/PDR/CDR/TRR/Bau replace the phase
 * gates, the build gates and the gate state. They are passed through (`computeMarks`,
 * `ReadinessReport.marks`); the rule coverage per phase that used to be computed HERE
 * (`computePhaseReadiness`, `currentPhaseGate`, CR-GC-296/745) is gone without a successor — a
 * second answer to "is this mark reached" is exactly what the one mechanism removes.
 *
 * @author andreas@siglochconsulting
 */
export {
  GRAPHCODE_INCOSE_SCOPE,
  MARK_LABELS,
  computeMarks,
  summarizeReadiness,
  computeReadiness,
  scoreReadiness,
  getFamilyRuleIds,
  type IncoseScope,
  type ReadinessMark,
  type ReadinessReport,
} from '@sigloch/graphcode-client';
