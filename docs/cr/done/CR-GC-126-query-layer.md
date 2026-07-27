# CR-GC-126: Query-Layer: Cypher, korrekte Impact-Richtung (KNOW statt guess)

**Status:** Done · **Closed:** 2026-06-18 · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `MOD-mcp-tools`, `MOD-harness`, `REQ-query-precision`, `REQ-progressive-expansion`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
graph_impact/expand/elements über Kuzu-Cypher statt TS-BFS; korrekte Blast-Radius-Richtung (eingehende Caller/Traces/Tests); TS-Mirror als Read-Pfad retiren. Major target: die richtigen Elemente WISSEN (Graph), nicht raten (grep). (SP-1/SP-2)

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-111
