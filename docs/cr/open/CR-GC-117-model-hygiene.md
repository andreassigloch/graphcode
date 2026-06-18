# CR-GC-117: Modell-Hygiene: V3_RULES-Violations schließen

**Status:** Open · **Milestone:** `MS-4-mvp2` (Phase 3) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `REQ-rule-enforcement`, `REQ-graph-is-ssot`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
63 R-01 (REQs ohne verify-Trace) + 14 RD-01 (unresolved) auflösen → Readiness Richtung 0. Echte MVP-Readiness, nicht nur Regelbasis-Wechsel.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
alle MS-3-CRs
