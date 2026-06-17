# CR-GC-109: Live-Event + View-Contract → @sigloch/contracts

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` (Phase 0) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-3-mvp-readiness`, `REQ-live-event-in-contracts`, `REQ-versioned-broadcast`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Publish LiveUpdateEvent/UpdateDomain (heute nur graphcode src/emit.ts) als Zod-Schema nach contracts, damit Dashboard/Bridge denselben Vertrag importieren (kein Fork, analog D1).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
—
