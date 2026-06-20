# CR-GC-120: Batch-Seed/Import (UNWIND) — Scale

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** `@sigloch/graph-cypher-wasm` `kuzu-adapter.ts` — `saveNodes`/`saveEdges` von Per-Row-MERGE auf **gruppiertes UNWIND-Batch-MERGE** umgestellt (je Node-Label / je `(table,srcLabel,tgtLabel)`-Gruppe ein Statement; Werte inline via `escapeString`, da `engine.exec` kein Param-Binding hat). StorageAdapter-Interface unverändert, kein Parallelpfad. **Gemessen 5k+5k: 29.7s → 5.3s (5.6× gesamt, Edges 9.6×).** Root-Cause-Fix einer Zwischen-Regression (immer-NULL-Spalten nicht mehr projiziert), keine Threshold-Inflation. Neuer `tests/perf.batch-seed.test.ts` (real-disk Kuzu, < 15s, Round-Trip + lossless attrs_json). Paket-Suite 27/27 + graphcode 117/117 grün. Neu im Graph: `REQ-batch-seed-performance` + `TEST-batch-seed` (verify), `CR-GC-120`→done.
**Graph (SSOT):** realisiert `MOD-harness`, `FUNC-import`, `REQ-bootstrap-through-gate`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
Per-Node/Edge-MERGE ist O(langsam): 10k Edges = 51s gemessen (SP-2). UNWIND-Batch-Insert → Seed/Import sub-Sekunde, damit 10k-Knoten real wird.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
M2
