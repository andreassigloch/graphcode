# CR-GC-369 — Ein `npx` für die Installation: GVE ist Dependency, kein zweiter Download

**Status:** done · **Angelegt:** 2026-08-19 · **Geschlossen:** 2026-08-19

> ## Abschluss 2026-08-19
>
> Umgesetzt wie geplant (4 Dateien + `package-lock.json`). Gesamtsuite grün
> (102 Dateien / 780 Tests), `npm run build` grün. Smoke: der aufgelöste Entry
> `node_modules/@sigloch/graph-view-edit/bin/gve.mjs`, mit `process.execPath`
> gestartet, bindet, antwortet auf `api/dashboard` mit seinem `repoRoot` und
> schreibt `docs/views/dashboard.url` — ohne npx-Wrapper.
>
> ### Abweichung: `process.execPath` statt Shebang
>
> Der CR sagte „Start über den aufgelösten Paketpfad". Gestartet wird er mit
> **demselben node**, der den Host fährt (`spawn(process.execPath, [entry, …])`),
> nicht über das Exec-Bit der Datei: der Entry liegt in `node_modules`, wo weder
> Exec-Bits noch das `node` auf dem PATH verlässlich sind.
>
> ### Nebenbefund: der Test greift jetzt die echte Auflösung ab
>
> Neben dem injizierten Pfad prüft ein Test `resolveGveEntry()` ungemockt — er
> schlägt fehl, sobald die Dependency aus `package.json` verschwindet. Das ist die
> Gegenprobe zur Offline-Zusage; ein rein injizierter Test hätte sie nicht.

## Problem

Die Installation kostet den Kunden zwei npx-Roundtrips:

1. `npx @sigloch/graphcode init` — das gewollte.
2. Beim ersten Start lädt `maybeStartGve` das Dashboard nach:
   `npx -y @sigloch/graph-view-edit` (`src/mcp-server.ts`).

Folge: langsamer Erststart, offline schlägt das Dashboard fehl (nur eine WARN-Zeile
auf stderr), und die Version des Viewers ist an nichts gebunden — jede Session zieht,
was die Registry gerade als `latest` führt, gegen ein `graphcode`, das dazu passen muss.
Zusätzlich nennt `README.md` (Zeile 13/14) `init` **und** `mcp` als einzugebende
Befehle, obwohl `mcp` der Agent-Host aus `.mcp.json` startet.

## Ziel

Ein Befehl installiert alles: `npx @sigloch/graphcode init`. Der Viewer kommt aus
`node_modules`, versioniert per semver, offline lauffähig.

## Umsetzung

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `package.json` | `@sigloch/graph-view-edit` als **dependency** (`^0.2.0`). GVE hält `graphcode` nur in `devDependencies` → kein Laufzeit-Zyklus. Kosten: das gebaute `dist/` des Viewers liegt im Install. |
| 2 | `src/mcp-server.ts` | Start über den aufgelösten Paketpfad (`createRequire(import.meta.url).resolve('@sigloch/graph-view-edit/bin/gve.mjs')`) statt `npx -y`. `GRAPHCODE_GVE_BIN` bleibt der Override für lokale Checkouts, `GRAPHCODE_NO_GVE=1` der Aus-Schalter. Kein `npx`-Pfad daneben stehenlassen — schlägt die Auflösung fehl, ist das die WARN-Zeile. |
| 3 | `tests/gve-autostart.test.ts` | Spawn-Assertion auf den aufgelösten Pfad; neuer Fall: Auflösung schlägt fehl → WARN, kein Spawn, Host läuft weiter. |
| 4 | `README.md` | Installation = **ein** Befehl. `mcp` als Host-Zeile markieren (was `.mcp.json` startet), nicht als Kundenkommando. |

4 Dateien. Reihenfolge: nach CR-GC-368 (beide fassen `README.md` an).

## Akzeptanzkriterien

- [ ] Nach `npm i @sigloch/graphcode` startet das Dashboard **ohne** Netzwerkzugriff.
- [ ] `ps` zeigt den Viewer aus `node_modules/`, kein `npx`-Wrapper-Prozess mehr.
- [ ] `GRAPHCODE_GVE_BIN` und `GRAPHCODE_NO_GVE=1` wirken unverändert.
- [ ] `README.md` nennt genau einen Befehl für die Installation.
- [ ] `npm test && npm run build` grün.
