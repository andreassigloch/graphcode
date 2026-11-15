# CR-GC-947: Zeile je CR erweitern: Schlupf ohne Link-Modus-Tests, Grenzmenge, Abgleich Modell und Code, Dauer Auswahl gegen Volllauf, Werkzeuglatenz

**Typ:** aus Item ITEM-2026-1375 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1375.json (Lane: code)

---

**Status:** Umgesetzt 2026-11-15.

## Anlass

`npm run verify:full <CR>` schreibt je CR eine Zeile nach `docs/messung/testauswahl.jsonl`. Zwei Mängel:

**1. Der Schlupf misst den Rechner mit.** 45 von 109 Läufen der Spur CODE haben Schlupf. 25 davon bestehen
nur aus `distribution.test.ts` und `lockfile-sync.test.ts`. Beide sind im Link-Modus (`npm run link:siblings`)
erwartet rot. Sie setzen die Bewährung „10 CRs ohne Schlupf" zurück, ohne etwas über die Testauswahl zu sagen.

**2. Vier Größen haben keinen Verlauf.** Grenzmenge und Abgleich von Modell und Code stehen nur in
`docs/messung/stand.md` (Stand 2026-10-09). Die Dauer der Auswahl gegen den Volllauf misst niemand; sie ist
die Zahl, an der sich die Bewährung entscheidet.

## Zielbild

Die Zeile je CR trägt zusätzlich:

| Feld | Inhalt | Quelle |
|---|---|---|
| `linkModus` | ob `@sigloch/*` auf Arbeitskopien zeigt | `node_modules/@sigloch/*` ist ein Symlink |
| `umgebung` | rote Tests, die im Link-Modus erwartet rot sind; sie zählen nicht als Schlupf | Liste in `test-schlupf.ts`, heute zwei Dateien |
| `dauer` | Laufzeit der Auswahl und des Volllaufs in ms | Bericht von vitest, Summe je Testdatei |
| `grenzmenge` | FUNC und SCHEMA an Modulgrenzen: im Modell von Pflichtmenge | `scripts/grenzmenge.mjs` |
| `abgleich` | Aufrufe über Modulgrenzen: von einem FLOW getragen von allen | dieselben Fakten, auf denen RC-12 urteilt |

Eine alte Zeile ohne ein Feld heißt „nicht erfasst" (`null`), nicht 0. Die Werkzeuglatenz (T-E8) bleibt in
`npm run messung`: der Lauf des Spikes ist kein Teil der Suite.

## Vorgehen

1. `SchlupfZeileSchema` um die fünf Felder erweitern, alle optional; Lesen alter Zeilen bleibt gültig.
2. `schlupfVon` nimmt die Umgebungsliste und den Link-Modus; `schlupfFreieFolge` rechnet auf dem bereinigten Schlupf.
3. `scripts/verify-full.mjs` erhebt die Felder. Kostet eine Messung mehr als 10 s, wandert sie nach
   `npm run messung`, und der CR nennt Messung und Dauer.
4. Die Folge ohne Schlupf über die bestehende Datei neu rechnen; alte und neue Zahl in diesen CR schreiben.
5. Modell: Beschreibung von `FUNC-measure-test-schlupf` und des Schemas nachführen.

## Abnahme

- [x] Im Link-Modus zählt ein roter `distribution.test.ts` unter `umgebung`, nicht als Schlupf; ohne
      Link-Modus zählt er als Schlupf (Test, vorher rot; `tests/test-schlupf.test.ts`).
- [x] Eine Zeile aus dem Bestand ohne die neuen Felder wird gelesen (Test).
- [x] Die Zeile dieses CRs in `testauswahl.jsonl` trägt `dauer`, `grenzmenge` (`abgleich` entfällt, siehe Abweichungen).
- [x] `npm run verify:full CR-GC-947` grün.

---

## Abweichungen

- **`abgleich` entfällt.** Die Regeln RC-12/RC-13 liegen in `@sigloch/contracts` (`call-rules`). Sie liefern
  `callCoverage` (Fluss-Paare: geprüft, ohne Bindung, außerhalb `callScope`, async, ohne `sync`) und die Befunde von
  RC-13 (Aufruf ohne Fluss). Eine Zählung „Aufrufe über Modulgrenzen, von einem FLOW getragen, von allen" gibt es nicht:
  getragene Aufrufe zählt keine der beiden Funktionen, und die Modulgrenze filtert keine. Sie aus `checked`, den
  RC-12-Befunden und den RC-13-Befunden zusammenzusetzen wäre eine zweite Rechnung mit eigenem Urteil. Sie gehört,
  wenn gewünscht, als Zählung in contracts (Familie, Version-Bump). Die Zeile trägt das Feld nicht.
- **`dauer` ist Rechenzeit.** Summe `endTime - startTime` je Testdatei; Dateien laufen parallel, die Summe liegt über der Wanduhr.
- **`schlupfFreieFolge` blieb unverändert.** Die Zeile speichert den bereinigten Schlupf; die Dateien der Umgebung stehen
  unter `umgebung`. Alte Zeilen tragen kein `linkModus` und gelten unverändert (nicht rückwirkend umgedeutet).
- **Kosten:** `grenzmenge` ~20 ms, `dauer` ohne eigene Messung (liest den vorhandenen Bericht); beides unter 10 s, beides in der Zeile.

## Schritt 4: Folge ohne Schlupf über `testauswahl.jsonl` (167 Zeilen)

- Alte Rechnung: 3.
- Neue Rechnung: 3 (alte Zeilen unverändert gewertet).
- Zur Information, alte Zeilen rückwirkend um die zwei Umgebungsdateien bereinigt: ebenfalls 3 (gerechnet, nicht
  weiter untersucht). 25 der 119 CODE-Zeilen hatten nur Umgebungsdateien als Schlupf.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Zählt ein im Link-Modus erwartet roter Test als Schlupf? | Nein. Er steht unter `umgebung`. | Der Schlupf misst die Testauswahl. Der Link-Modus ist ein Zustand des Rechners (`CLAUDE.local.md`). CI fährt ohne Link-Modus und fängt beide Tests. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1200, Tiefe 1, Wurzeln: `FUNC-verify-lane-full`, `FUNC-measure-test-schlupf`._

Reichweite: 8 Elemente (FLOW 5, FUNC 3); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 2):
- scripts/verify-full.mjs
- src/projections/test-schlupf.ts

Tests (`graph_tests`, 4):
- tests/cli.scaffold.test.ts
- tests/knowledge-binding.test.ts
- tests/test-schlupf.test.ts
- tests/test-selection.audit.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
