# CR-GC-120: Batch-Seed/Import (UNWIND) — Scale

**Status:** Open · **Milestone:** `MS-4-mvp2` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `MOD-harness`, `FUNC-import`, `REQ-bootstrap-through-gate`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
Per-Node/Edge-MERGE ist O(langsam): 10k Edges = 51s gemessen (SP-2). UNWIND-Batch-Insert → Seed/Import sub-Sekunde, damit 10k-Knoten real wird.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
M2
