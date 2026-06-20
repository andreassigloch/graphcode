# CR-GC-109: Live-Event + View-Contract → @sigloch/contracts

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 0) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** `UpdateDomainSchema` + `LiveUpdateEventSchema` (+ Typen) als Zod nach `@sigloch/contracts/harness` (Subpath, **nicht** `se/` — keine Ontologie-Änderung; Paket-Minor-Bump 0.2.0→0.3.0). graphcode `src/emit.ts` retiret die lokale `interface`/`type` und **re-exportiert** aus contracts (kein Parallelpfad; `src/index.ts` + Tests unverändert, da Re-Export-Pfad). Neuer `tests/contract.live-event.test.ts` (`TEST-live-event-contract`, 5 Cases): Schema parst valide Events / lehnt unbekannte Domain, falschen Typ, fehlendes ts ab; **echte Mutation emittiert ein Event, das byte-genau durch `LiveUpdateEventSchema` round-trippt** → Emitter und Contract können nicht driften. `REQ-live-event-in-contracts` + `TEST-live-event-contract` → done. **`REQ-versioned-broadcast` bleibt offen** (geteilt mit CR-114, das den eigentlichen versioned Diff-Broadcast implementiert; verifiziert via `TEST-live-view`). 122/122 grün. Contracts-Bump = Family-Package, leichter Review (Harness-Surface, keine Ontologie/Rule).
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `REQ-live-event-in-contracts`, `REQ-versioned-broadcast`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Publish LiveUpdateEvent/UpdateDomain (heute nur graphcode src/emit.ts) als Zod-Schema nach contracts, damit Dashboard/Bridge denselben Vertrag importieren (kein Fork, analog D1).

## Spec-Knoten ergänzt (2026-06-19)
`REQ-live-event-in-contracts` draft→open + `TEST-live-event-contract` (verify, R-01 geschlossen).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
—
