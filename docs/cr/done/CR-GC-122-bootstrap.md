# CR-GC-122: New-Member Bootstrap durchs Gate (Format-E Cold-Start)

**Status:** Done · **Closed:** 2026-06-18 · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `FUNC-import`, `REQ-bootstrap-through-gate`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
Leeren Graphen eines NEUEN Familie-Mitglieds ausschließlich durchs mutate()-Gate befüllen (Quelle Format-E, kein Direct-Write); Cold-Start mit Template-SYS. Realisiert TEST-bootstrap.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-100, CR-103, CR-112
