# CR-GC-368 — `graphcode status`: mein Host, mein Dashboard, eine Zeile pro Antwort

**Status:** done · **Angelegt:** 2026-08-19 · **Geschlossen:** 2026-08-19

> ## Abschluss 2026-08-19
>
> Umgesetzt wie geplant, 5 Dateien. Realer Smoke gegen drei laufende Viewer:
> im eigenen Repo `Dashboard OK http://localhost:4318/` (exit 0), in `graphcode`
> `fremdes Repo` (exit 1) — dort läuft ein Viewer, der `repoRoot` noch nicht sendet.
> `npm run build` + Gesamtsuite grün (102 Dateien / 778 Tests).
>
> ### Abweichung 1: ein vierter Zustand `unidentified`
>
> Der CR kannte `running | foreign | not-running`. Ein Viewer, der antwortet, aber
> kein `repoRoot` nennt (älter als CR-GVE „api/dashboard nennt das Repo"), ist nicht
> fremd — er ist **nicht identifizierbar**, und die nächste Aktion ist eine andere
> (Viewer erneuern statt Adresse ignorieren). `maybeStartGve` darf beide gleich
> behandeln (beide → eigener Spawn); ein Bericht an einen Menschen darf es nicht.
>
> ### Abweichung 2: `status` schreibt auf stdout
>
> Der Rest der CLI berichtet auf stderr, weil stdout dem MCP-JSON-RPC gehört. In
> diesem Verb läuft kein Transport, und die Adresse soll kopier- und pipebar sein
> (`graphcode status | grep Dashboard`). Begründet im Case und im Datei-Header.

## Problem

Es gibt keine kundentaugliche Antwort auf „läuft mein Kram, und wo ist mein Browser-Fenster?".
Heute: `cat docs/views/dashboard.url` (Datei kann stale sein), `lsof`/`pgrep` (nichts
für Kunden), oder Raten des Ports. Jede GVE-Instanz startet auf demselben Default-Port
4317 und Vite bumpt bei Konflikt — bei mehreren offenen Repos zeigt ein geratener Port
**ein fremdes Repo**. Genau dieser Fehler war schon einmal live (CR: Viewer-Autostart
prüft Repo-Identität, Commit 89dbab7).

Aktueller Stand der Bausteine — vorhanden, aber ohne Bedienoberfläche:
- `docs/views/dashboard.url` — GVE schreibt die **echte** gebundene Adresse beim Listen,
  löscht sie beim Shutdown (`dashboardUrlPlugin`, graph-view-edit `vite.config.js`).
- `GET <url>api/dashboard` liefert `repoRoot` — die Identitätsprobe.
- `.graphcode/owner.lock` — PID/Hostname des Host-Prozesses, der den Store besitzt.

## Ziel

```
$ npx @sigloch/graphcode status
graphcode status — graph-view-edit  (/Users/…/dev/graph-view-edit)
  MCP-Host    OK             pid 40001, seit 2026-08-19T09:12:03Z
  Dashboard   OK             http://localhost:4318/
```

Fehlerfälle nennen **eine** nächste Aktion, kein Menü:

```
  MCP-Host    läuft nicht    → Agent-Session in diesem Repo starten (.mcp.json)
  Dashboard   läuft nicht    → startet mit dem MCP-Host; GRAPHCODE_NO_GVE gesetzt?
  Dashboard   fremdes Repo   http://localhost:4317/ bedient /Users/…/dev/graphcode
```

Read-only. `status` startet und stoppt nichts — Start ist Sache des MCP-Hosts,
Stop ist Sache des Host-Endes. Kein `pkill`, keine Portnummer im Kopf des Kunden.

Nicht in diesem CR: andere Repos verwalten, Instanzen-Liste, Stop-Kommando. Sonderfälle.

## Umsetzung

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `src/status.ts` **(neu)** | `collectStatus(repoRoot, deps)` + `formatStatus()`. Host: `.graphcode/owner.lock` lesen → `running` (PID lebt, gleicher Hostname) / `stale` (PID tot) / `none`. Dashboard: `dashboard.url` → `GET <url>api/dashboard` (750 ms) → `repoRoot` **realpath-vergleichen** → `running` / `foreign` / `not-running`. Injizierbares `fetch` für Tests. |
| 2 | `src/cli.ts` | `case 'status'` + USAGE-Zeile. Ausgabe auf **stdout** (kein MCP-Kanal in diesem Verb), Exit 0 wenn Host **und** Dashboard OK, sonst 1. |
| 3 | `tests/status.test.ts` **(neu)** | Tmp-Repo + Fake-`fetch`: OK-Fall, fehlende url-Datei, stale url-Datei (fetch wirft), fremdes Repo (anderer `repoRoot`), toter Lock-PID, Symlink-Pfad (realpath-Gleichheit). |
| 4 | `README.md` | `status` in die Kommandotabelle, direkt unter `mcp`. |
| 5 | `src/scaffold-templates.ts` | Abschnitt „Live view" in `GRAPHCODE.md`: `npx @sigloch/graphcode status` ist der Weg zur Adresse; `dashboard.url` bleibt die Maschinenquelle. |

5 Dateien.

## Akzeptanzkriterien

- [ ] `npx @sigloch/graphcode status` im laufenden Repo druckt Host-PID und die **echte** Dashboard-URL.
- [ ] Zeigt eine fremde Instanz auf demselben Port, meldet `status` „fremdes Repo" **und** nennt das bediente Repo — nie eine falsche URL als „meine".
- [ ] Stale `dashboard.url` (Prozess hart gekillt) → „läuft nicht", nicht die tote URL.
- [ ] Symlink-/`/private/var`-Pfad wird als eigenes Repo erkannt (realpath beidseitig).
- [ ] `npm test && npm run build` grün; `tests/status.test.ts` deckt alle fünf Zustände ab.
