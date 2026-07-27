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
