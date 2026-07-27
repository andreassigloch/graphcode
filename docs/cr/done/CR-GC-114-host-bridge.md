# CR-GC-114: Host + SSE/WS-Bridge (Single Kuzu Owner)

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** `src/host.ts` (`HostBridge`/`serveHost`) + `host`-CLI-Verb. **Bewusste Abweichung vom Brief (root-caused):** NICHT `@sigloch/graph-api-express`/`express` als Dep — das verletzt die verriegelte Distribution-Invariante (`tests/distribution.test.ts`: Runtime-Deps = exakt sdk/kuzu-wasm/zod) und `express`' transitives `debug` bricht das ESM-Bundle (`Dynamic require of tty`). Read-only-Bridge braucht kein Framework → auf `node:http` gebaut, **0 neue Runtime-Deps**. Read-only **strukturell** garantiert: jede Nicht-GET-Methode → 405, unbekannte Route → 404, kein Write-Pfad (POST /mutate, /batch → 404/405, Store unverändert; `TEST-readonly-bridge` Case c). SSE versioniert via monoton steigende `id:` (Last-Event-ID-Resume; `REQ-versioned-broadcast`). `/health` echt: Live-Store-Query + `evaluateRules()` + SE-Versionen (`REQ-real-health-check`). Single Kuzu Owner via `createHarness`. Genau ein SSE-Frame pro Gate-Mutation (`REQ-mutation-emits-event`). 13 Knoten → done (MOD-host-bridge, 4 FUNC, 6 REQ, 2 TEST). 125/125 grün, Bundle 126.8kb (kein express-Bloat). **Cruft entfernt:** stray `express` direct-devDep + extraneous graph-api-express Lock-Eintrag bereinigt (express bleibt transitiv via sdk).
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
