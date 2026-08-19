# CR-GC-370 — Der Host stirbt mit seiner Session (Zombie-Fabrik abstellen)

**Status:** done · **Angelegt:** 2026-08-19 · **Geschlossen:** 2026-08-19

> ## Abschluss 2026-08-19
>
> Umgesetzt wie geplant, 4 Dateien. Gesamtsuite grün (103 Dateien / 790 Tests).
>
> ### E2E im Wegwerf-Repo, beide Auslöser
>
> | Auslöser | Ergebnis |
> |---|---|
> | `SIGTERM` | `owner.lock`, `host.sock`, `docs/views/dashboard.url` entfernt, Viewer beendet |
> | stdin-EOF | dasselbe, ohne Signal — stderr: `host: shutting down (client disconnected)` |
>
> Vorher im selben Aufbau: `kill -TERM` beendete den Viewer (dessen eigener Handler),
> ließ aber `owner.lock` zurück — der Zustand, aus dem die Zombie-Hosts entstanden.
>
> ### Nebenbefund beim Aufräumen der Altlast
>
> Die sieben verwaisten Hosts ließen sich mit `SIGTERM` beenden, und ihre Viewer gingen
> mit — der Viewer-Teil des Abbaus funktionierte also schon, nur der Host-Teil fehlte
> komplett. Das erklärt, warum das Symptom „Dashboard weg, Host läuft" und nicht
> umgekehrt auftrat.

## Problem (gemessen, nicht vermutet)

Am 2026-08-19 liefen auf einer Entwicklermaschine **11 `graphcode mcp`-Hosts**, fünf davon
im selben Repo seit dem 16.08. — drei Tage nach dem Schließen ihrer Editor-Fenster. Der
Store-Lock des Repos gehörte pid 39953 (Start 2026-08-16T14:53Z). Jede seither geöffnete
Session verlor die Wahl gegen diesen Zombie und lief als Proxy.

**Root Cause:** `serveStdio` hat keinen Shutdown-Pfad. Nur `graphcode host` registriert
SIGINT/SIGTERM (`cli.ts`); der MCP-Host reagiert weder auf Signale, noch auf das Ende
seines stdio-Clients (stdin-EOF), noch schließt er Harness, Host-Socket oder Bridge. Er
stirbt ausschließlich, wenn das OS ihn tötet — und der Beleg dafür, dass das nicht
verlässlich passiert, sind die 11 Prozesse.

Folgeschäden, alle am selben Tag beobachtet:
1. **Neue Session = Proxy eines toten Editors.** Der Lock lebt, weil die PID lebt.
2. **Kein Dashboard.** `maybeStartGve` läuft nur in `electAndBoot`; Proxies starten keinen
   Viewer. Der Zombie-Host hat seinen längst verloren → Repo ohne Dashboard, Host „OK".
3. **Lock bleibt nach `kill -TERM` liegen.** Beim Aufräumen gingen die Viewer sauber (ihr
   eigener Signal-Handler räumt `dashboard.url` weg), die `owner.lock`-Dateien blieben —
   der Host hat keinen Handler, der `harness.close()` ruft.

## Ziel

Ein Host lebt genau so lange wie die Session, die ihn gestartet hat. Endet die Session
(Editor zu, Fenster neu geladen, `kill`), gibt er in dieser Reihenfolge frei: Viewer →
Bridge → Host-Socket → Store-Lock. Danach ist das Repo host-frei und die nächste Session
gewinnt eine **echte** Wahl.

Entscheidung (2026-08-19): **Der Viewer stirbt mit dem Host.** Keine Daemon-Prozesse ohne
sichtbaren Besitzer. Dass der Browser-Tab beim Editor-Neustart kurz ins Leere zeigt, ist
der akzeptierte Preis; die stabile Repo-URL (Folge-CR) macht ihn wieder gültig.

## Umsetzung

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `src/session-lifecycle.ts` **(neu)** | `SessionLifecycle`: `add({name, close})` sammelt Ressourcen, `shutdown(reason)` räumt in umgekehrter Registrierungsreihenfolge ab — idempotent, best-effort (ein Fehlschlag stoppt die Kette nicht), mit hartem Deckel (3 s), damit ein hängender Kuzu-Shutdown den Lock nicht behält. `installTriggers()` bindet stdin-EOF + SIGINT/SIGTERM/SIGHUP; alle Abhängigkeiten injizierbar. |
| 2 | `src/mcp-server.ts` | `electAndBoot` registriert Viewer, Bridge, Host-Socket und Harness beim Lifecycle (bisher wurde der Socket-Handle weggeworfen). `maybeStartGve` registriert **keine** eigenen Prozess-Handler mehr — es gibt genau einen Shutdown-Pfad, nicht zwei nebeneinander. |
| 3 | `tests/session-lifecycle.test.ts` **(neu)** | Reihenfolge, Idempotenz, Weiterlaufen nach Fehler, Timeout-Deckel, stdin-EOF und jedes Signal als Auslöser. |
| 4 | `tests/gve-autostart.test.ts` | Gegenprobe: `maybeStartGve` hängt keine Prozess-Listener mehr an und liefert den Kill-Handle. |

4 Dateien.

## Akzeptanzkriterien

- [ ] SIGTERM auf einen `graphcode mcp` entfernt `owner.lock`, `host.sock` und beendet den Viewer.
- [ ] stdin-EOF (Client weg) löst denselben Weg aus — ohne Signal.
- [ ] Zweimal auslösen räumt einmal ab (idempotent), auch wenn ein Teilschritt wirft.
- [ ] Nach dem Beenden gewinnt eine neue Session die Wahl (kein Proxy) und startet einen Viewer.
- [ ] `npm test && npm run build` grün.
