# CR-GC-237 — HTTP-Bridge folgt dem Store-Lock (Viewer + MCP koexistent)

**Status:** done · 2026-07-05
**Quelle:** graph-view-edit — `graphcode host` schlägt fehl, sobald eine MCP-Session den Store besitzt (`REQ-single-kuzu-owner`).

## Problem

`HostBridge.start()` (`src/viewer/host.ts`) ruft `createHarness` unconditional — der `host`-Befehl versucht immer, Owner zu werden, statt an der CR-GC-235-Election teilzunehmen. Läuft bereits eine `graphcode mcp`-Session (der Normalfall in einem aktiven Repo), stirbt `graphcode host` am Owner-Lock. Live-Viewer (SSE) und Agent-Sessions schließen sich damit gegenseitig aus — genau in dem Setup, für das der Live-View gedacht ist.

## Änderung (Variante B: Bridge folgt dem Lock)

Wer die Election gewinnt, serviert zusätzlich die Read-only-HTTP-Surface — ein Owner, ein Serving-Point, kein neues Protokoll:

- `HostBridge` entkoppeln: HTTP-Surface kann an eine **bestehende** Harness attachen (Konstruktor-Injection) statt eine eigene zu erzeugen. Eigene-Harness-Variante bleibt nur für den session-losen `graphcode host`-Betrieb.
- Elected MCP-Host (`serveStdio`): wenn `GRAPHCODE_HOST_PORT` gesetzt, Bridge auf dieser Harness starten; `onUpdateEvent` → SSE-Broadcast binden.
- Promote-Pfad (`host-shim.ts`): der re-elected Host startet die Bridge ebenfalls (Port ist frei, alter Owner tot) — kein toter Viewer nach Host-Wechsel.
- `graphcode init`/`update` (`scaffold.ts`): `GRAPHCODE_HOST_PORT` in die `.mcp.json`-`env` scaffolden — damit "managt init das", ohne Runtime-Logik in init.
- `graphcode host` (`cli.ts`): bei bestehendem Owner nicht mehr crashen, sondern klare Meldung + Port des laufenden Owners ausgeben (kein zweiter Serving-Pfad).

Verworfen: Variante A (`host` als Read-only-Socket-Client) — bräuchte Event-Push im Shim-Protokoll (heute strikt Request/Response) und eine zweite Serving-Topologie.

## Betroffene Dateien (≤6, wie umgesetzt)

1. `src/viewer/host.ts` — HarnessInjection, Own/Attach-Split
2. `src/mcp-server.ts` — `maybeStartBridge` in `electAndBoot`; deckt den Promote-Pfad mit ab (`promote: electAndBoot` — kein `host-shim.ts`-Change nötig)
3. `src/scaffold.ts` — deterministischer Port (FNV-1a über repoRoot → 4600–4899) in `.mcp.json`-env; user-editierter Port überlebt `update`
4. `src/cli.ts` — `host`-Befehl: Owner-exists-Meldung statt Crash (Exit 0)
5. `src/emit.ts` — Root-Cause-Fix beim Umsetzen gefunden: eager `mkdir` im Trajectory-Hook = floating Promise → Unhandled Rejection, wenn eine Harness die Election verliert und nie mutiert; jetzt lazy
6. Tests — `tests/host.bridge-attach.test.ts` (Own-Kollision, Attach+SSE, `maybeStartBridge`-Env-Pfade) + nachgezogene Asserts in `cli.scaffold`/`mvp-e2e`

## Akzeptanz

- [ ] `graphcode mcp` (Owner) mit `GRAPHCODE_HOST_PORT=4680` → `GET /health` 200, `GET /events` liefert `invalidate`-Frame nach `graph_mutate`
- [ ] Zweite MCP-Session (Proxy) → Bridge bleibt allein beim Owner, keine Port-Kollision
- [ ] Host-Kill + Promote → neuer Owner rebindet denselben Port, SSE funktioniert weiter
- [ ] `graphcode host` bei bestehendem Owner: Exit 0 mit Hinweis auf laufenden Port, kein Lock-Crash
- [ ] `graphcode init` scaffoldet `GRAPHCODE_HOST_PORT`; ohne gesetzten Port startet keine Bridge (Verhalten wie heute)
- [ ] Read-only-Garantie unverändert: nur GET-Routen, kein Mutate-Handler (REQ-readonly-bridge)
