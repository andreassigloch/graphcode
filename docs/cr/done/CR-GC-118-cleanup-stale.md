# CR-GC-118: Cleanup stale-at-all Knoten

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 3) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** Dual-Status-Bug betraf **9** CRs (CR-GC-100..108), nicht 5 — alle nested `attributes.attributes.status:open` auf `{}` normalisiert. `TEST-harness-install` (totes aimprove-init.sh) gelöscht (REQ-repo-install behält `TEST-distribution` als echten Verifier). `REQ-dashboard-ontology-sync` war bereits `done` (no-op). `REQ-graph-is-ssot`→done. Alle 110 Tests grün, Graph spec-grün.
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `REQ-graph-is-ssot`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Dual-Status-Bug (attributes.status:open auf 5 done CRs entfernen), TEST-harness-install (totes aimprove-init.sh), REQ-dashboard-ontology-sync Status auf done.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
—
