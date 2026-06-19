# CR-GC-114: Host + SSE/WS-Bridge (Single Kuzu Owner)

**Status:** Open · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `MOD-host-bridge`, `REQ-readonly-bridge`, `REQ-versioned-broadcast`, `REQ-mutation-emits-event`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Host-Prozess besitzt .graphcode/kuzu, exponiert graph-api-express + neue SSE-Route an harness.onUpdateEvent. Versioned Diff-Broadcast. Kein Express-REST im Core.

## Spec-Knoten ergänzt (2026-06-19)
`MOD-host-bridge` war unterspezifiziert (0 FUNC) — ergänzt: `FUNC-serve-sse` (satisfy `REQ-readonly-bridge`), `FUNC-broadcast-diff` (satisfy `REQ-versioned-broadcast`), `FUNC-own-kuzu-host` (satisfy `REQ-single-kuzu-owner`), `FUNC-health-endpoint` (satisfy `REQ-real-health-check` — die aus CR-GC-115 hier allokierte Health-REQ). `REQ-readonly-bridge` erhält `TEST-readonly-bridge` (R-01 geschlossen).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-GC-109
