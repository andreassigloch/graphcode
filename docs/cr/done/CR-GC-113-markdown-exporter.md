# CR-GC-113: Graph→Markdown Re-Exporter

**Status:** Done · **Closed:** 2026-06-18 · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-3-mvp-readiness`, `MOD-docs`, `FUNC-export-markdown`, `REQ-doc-export`, `REQ-pre-export-markdown`, `REQ-post-export-markdown`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Kuzu/Graph → commit-fähige docs (SSOT-Round-Trip Kuzu→JSON/Markdown); ersetzt Hand-Edits an graphcode.graph.json.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
M2 (Codec)
