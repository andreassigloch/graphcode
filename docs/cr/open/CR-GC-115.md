# CR-GC-115: Dashboard-Viewer-App (Hybrid)

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-3-mvp-readiness`, `MOD-dashboard`, `UC-live-graph-view`, `REQ-dashboard-ontology-sync`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
graphcode-owned Dashboard: @sigloch/graph-renderer (Cytoscape) + dashboard-shell, konsumiert die Host-Bridge; Readiness/INCOSE-Panels gegen V3_RULES (CR-GC-107-Scorer). aimprove-Komponenten (~1.7k LoC) repointen.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-GC-114, CR-GC-110
