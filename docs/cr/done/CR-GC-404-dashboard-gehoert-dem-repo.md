# CR-GC-404 — Das Dashboard gehört dem Repo, nicht dem ersten Fenster

**Status:** DONE 2026-08-22
**Dateien:** `src/gve.ts`, `src/gve-sessions.ts` (neu), `src/mcp-server.ts`,
`tests/gve-supervision.test.ts`, `tests/gve-autostart.test.ts` (5)

## Root Cause

Der Viewer gehörte dem **Gewinner der Store-Wahl**. `electAndBoot` startete ihn, der
`SessionLifecycle` derselben Session tötete ihn. Wer das Fenster schloss, das zufällig als
erstes gestartet war — meist das älteste —, nahm allen anderen offenen Sessions das
Dashboard mit; die liefen als Proxy weiter und merkten nichts davon.

Belegt in den MCP-Logs von `graphcodedemo` (2026-08-22):

```
12:05:24  gve: dashboard starting …            ← Wahlgewinner, pid 7422
12:06 … 18:25  client: store owned by pid 7422 — proxying …   (5 Sessions)
              ← Fenster von 7422 geschlossen, Viewer tot, von Hand neu gestartet
18:31:46  gve: dashboard already serving this repo at http://localhost:4899/
```

Zwei Folgen, beide gemessen:

1. **Zurückgeholt wurde er nur zufällig.** Eine Proxy-Session wählt erst neu, wenn ein
   Werkzeugaufruf auf den toten Socket läuft (`buildProxyRegistry.promote`). Bis dahin: kein
   Dashboard, obwohl mehrere Sessions offen sind.
2. **Ein übernommener Viewer stand unter gar keiner Aufsicht.** `maybeStartGve` gab bei
   „bedient dieses Repo schon" `null` zurück, `superviseGve` daraufhin kein Handle — der
   Viewer der letzten Zeile oben gehörte ab da niemandem mehr.

## Fix

Der Viewer gehört dem **Repo**. Eine Regel, drei Konsequenzen:

- **Jede Session sorgt für einen Viewer** — Wahlgewinner wie Proxy. `attachGve` hängt
  deshalb in `serveStdio` hinter der Wahl, nicht in `electAndBoot`.
- **Die Aufsicht ist eine Umfrage** (10 s, Identitäts-Probe), kein Eltern-Kind-Band: so
  bemerkt auch eine Session den Tod des Viewers, die ihn nicht gestartet hat. Eine
  Startreservierung mit Ablauffrist (`.graphcode/gve.spawn.lock`, 20 s) verhindert, dass N
  Sessions N Viewer starten — zwischen „keiner antwortet" und „der neue bindet den Port"
  liegen Sekunden, in denen die Probe noch nichts sieht.
- **Erst die letzte Session macht das Licht aus.** `.graphcode/sessions/<pid>` je Session,
  tote Einträge werden beim Lesen entfernt; beendet wird nur, was graphcode selbst gestartet
  hat (`.graphcode/gve.pid`) — ein Hand-Start `gve --repo .` bleibt stehen.

Nebenbei geschlossen: der Viewer eines **hart getöteten** Hosts lief bisher unsterblich
weiter (niemand hielt mehr ein Handle). Sein Session-Eintrag zählt jetzt nicht mehr mit, und
die nächste Session, die geht, räumt ihn über die PID-Datei ab.

Die alte kind-getriebene Aufsicht (`superviseGve`, `maybeStartGve`) ist **gelöscht**, nicht
danebengestellt.

## Nachweis

- `tests/gve-supervision.test.ts` (9): Neustart nach unbemerktem Tod, Versuchsgrenze und
  Budget-Reset, zwei Sessions → ein Viewer, **Ende einer Session lässt ihn stehen**, letzte
  Session beendet ihn, Hand-Start bleibt stehen, Waisen-Pfad. Der zentrale Test wurde gegen
  die alte Semantik rot gesehen.
- `tests/gve-autostart.test.ts` (12): die Wachen unverändert (Opt-out, Runner, Identität
  statt Erreichbarkeit, Startkommando).
- End-to-End gegen einen echten Viewer: Host + Proxy, Host geschlossen → Viewer lebt weiter,
  Proxy geschlossen → Viewer weg, PID-Datei weg; `kill -9` auf den Viewer → nach einem Poll
  wieder da.
