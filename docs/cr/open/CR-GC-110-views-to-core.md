# CR-GC-110: views.ts → graph-api-core; BQ-Regel-Fork retiren

**Status:** Open · **Milestone:** `MS-4-mvp2` (Phase 0) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `REQ-shared-views-no-fork`, `FUNC-render-views`, `MOD-docs`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
View-Berechnung (testmatrix/FMEA/RTM/IRR/NFR/arch…) aus aimprove/learning-engine/graph nach @sigloch/graph-api-core; lokalen BQ-Fork (aimpro/src/contracts/se) auflösen/migrieren — Familie-Review (Drift-Lock L1/L2).

## Spec-Knoten ergänzt (2026-06-19)
`REQ-shared-views-no-fork` draft→open + `TEST-shared-views-no-fork` (verify, R-01 geschlossen).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
—
