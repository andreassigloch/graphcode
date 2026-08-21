# CR-GC-377 — `graphcode upgrade` ersetzt `update`: ein Befehl, der wirklich alles aktuell macht

**Status:** done · **Angelegt:** 2026-08-20 · **Geschlossen:** 2026-08-21 · **Vorgänger:** CR-GC-376 (Diagnose)

## Problem

`graphcode update` heißt wie „aktualisieren", refresht aber nur Artefakte. Wer die
Version wechseln wollte, musste **drei** Dinge selbst wissen und tun:

1. `npm i @sigloch/graphcode@<v>` — `update` ruft kein npm (kein `execSync`/`spawnSync`
   in `scaffold.ts`), es schreibt nur einen Dep-Range.
2. Den Range der **richtigen** Version erwischen: `update` schreibt den der Version,
   die es gerade ausführt. In einem Repo mit altem `node_modules` führt `npx … update`
   den **alten** Build aus und zementiert dessen Range.
3. Den laufenden Host beenden — er lebt mit dem Code, mit dem er gebootet hat.

Das ist graphcode-internes Wissen (npx-Auflösung, Store-Ownership, Artefakt-Herkunft),
das ein Nutzer nicht haben muss und nicht haben will.

## Ziel

Drei Verben für den Menschen: `init` (einbauen), `upgrade` (alles aktuell machen),
`status` (sagen, wie es steht). `update` ist **ersatzlos gestrichen** — kein Alias,
kein „deprecated but works".

```
$ graphcode upgrade
graphcode upgrade — Ziel 0.17.0
  CLI          0.17.0
  Repo-Install 0.17.0 (vorher 0.13.2)
  Host         beendet
  · Repo-Install: 0.13.2 → 0.17.0
  · Artefakte: von 0.17.0 geschrieben
  · Host: pid 15620 beendet — startet mit der nächsten Agent-Session neu
```

Die Reihenfolge **ist** die Logik:

1. **Ziel bestimmen** — `npm view` oder `--to <version>` (damit der Befehl offline
   benutzbar bleibt statt am Proxy zu hängen).
2. **Repo-Install ziehen** — das ist der Build, den `npx` aus `.mcp.json` zuerst nimmt,
   also der, den die nächste Agent-Session bootet.
3. **Artefakte vom NEU installierten Build schreiben lassen** (Re-Exec auf
   `node_modules/.../cli.js upgrade --refresh-only`). Sonst schreibt der alte Build die
   Skills der neuen Version — genau die Drift, die der Befehl beseitigt.
4. **Alten Host beenden** (`--keep-host` hält ihn). Ohne diesen Schritt läuft nach dem
   Upgrade weiter die alte Ontologie.

Jeder Schritt landet im Bericht, auch der übersprungene. Kein stiller Erfolg.

Ein Downgrade passiert nie von selbst: liegt die Registry hinter dem, was installiert
ist (Normalfall auf einer Entwicklermaschine mit unveröffentlichtem Build), bricht der
Befehl ab und nennt `--to` als bewussten Weg.

Flags: `--check` (nur berichten, Exit 1 bei Drift) · `--to <version>` (ohne Registry) ·
`--keep-host` · `--global` (auch das global installierte Paket; **ohne** das Flag fasst
ein Repo-Befehl die Maschine nicht an).

`status` zeigt ab jetzt in **allen** Drift-Fällen auf genau dieses eine Kommando statt
auf npm-Handgriffe.

## Änderungen

| Datei | Was |
|---|---|
| `src/upgrade.ts` | **neu** — Ziel, Install, Re-Exec-Refresh, Host-Stop, Bericht |
| `src/cli.ts` | Verb `upgrade` (inkl. `--refresh-only`), Verb `update` gelöscht, Usage |
| `src/status.ts` | drei Reader exportiert (eine Quelle für Host/Repo/Vergleich); Drift-Aktion = `graphcode upgrade` |
| `src/scaffold-templates.ts` | die in Consumer-Repos geschriebene GRAPHCODE.md nennt `upgrade` |
| `README.md` · `rig/plan-step/GRAPHCODE.md` | dito |
| `tests/upgrade.test.ts` | **neu**, 13 Fälle |
| `tests/status.test.ts` | Aktion je Drift-Fall |

`scaffold()` behält intern die Aktion `'update'` — auf **dieser** Ebene ist der Name
korrekt (Artefakt-Refresh, kein Versionswechsel). Missverständlich war der CLI-Verb,
und der ist weg. `CliCommandSchema` und `tests/cli.scaffold.test.ts` bleiben unberührt.

## Migration

Ein Repo, dessen Ziel-Build `--refresh-only` noch nicht kennt (< 0.17.0), bekommt den
Refresh über das alte interne Verb. Ein Schalter, eine Zeile, löschbar sobald kein Repo
mehr unter 0.17.0 liegt (`REFRESH_ONLY_SINCE`).

## Nicht in diesem CR

- **Pin in `.mcp.json`** (`npx -y @sigloch/graphcode@<version> mcp`) — CR-GC-378. Erst
  damit ist die laufende Version eine Zahl, die im Repo steht, statt ein
  Auflösungsergebnis.
- **Graph nachziehen** — CR-GC-379: `FUNC-search-updates` löschen (geht in `upgrade`
  auf, `--check` ist die Registry-Abfrage), `FUNC-upgrade` als Realisierung anlegen.

## Akzeptanzkriterien

- [x] `upgrade` installiert, refresht aus dem Zielbuild und beendet den Host — in dieser Reihenfolge
- [x] Fehlgeschlagener Install → kein Artefakt-Schreiben, lauter Abbruch
- [x] Fehlgeschlagener Refresh → lauter Abbruch, der sagt, was installiert ist und was nicht
- [x] Ohne Registry: klare Meldung + `--to`-Weg, nichts geändert
- [x] `--global` ist die einzige Art, das globale Paket anzufassen
- [x] Registry-Ziel < Installiertes → Abbruch statt stillem Downgrade (`--to` erzwingt)
- [x] `update` existiert nicht mehr (Code, Usage, README, scaffoldete GRAPHCODE.md)
- [x] `status` nennt bei Drift genau `graphcode upgrade`
- [x] `npm run build` grün; Suite 828/829 — der eine rote Fall (`tests/distribution.test.ts`)
      hängt an den unveröffentlichten Peer-Ranges im uncommitteten `package.json`
      (`@sigloch/contracts@^6.0.0` existiert in der Registry nicht), nicht an diesem CR
- [x] Realer Smoke in `graphcodedemo`: `upgrade --check` meldet Ziel/Repo/Host, Exit 1, nichts geändert
