# CR-GC-639: KPI 1 nach jedem CR-Abschluss — gemessen, nicht gerufen

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-524 (idea)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-524.json (Lane: code)

---

## Befund

Die Frage „fragt der Agent den Graphen oder greppt er?" ist die zentrale Zusage dieses Repos. Gemessen
war sie nur, wenn jemand eine Retro machte (`se-retro`) oder ein bezahltes Rig fuhr. Der naechste
Schritt waere ein Vier-Arme-Rig gewesen, 20–40 $ fuer je einen Lauf, also ohne Streuung.

**Vorschlag des Auftraggebers:** nach jedem CR nachschauen. Kostet nichts und liefert echte Streuung.

Beim Nachsehen, ob es die Messung schon gibt, fanden sich **zwei halbe**:

| | definiert KPI 1 | zaehlt |
|---|---|---|
| `scripts/retro-kpi.mjs` (CR-GC-212) | ja, nach `docs/KPI.md` | **nein**: `toolUsage` kommt von Hand |
| `rig/referenz-change/messen.mjs` (CR-GC-633) | **eigene** Definition (nur Lesen, ohne Doc-Reads) | ja |

Zwei Definitionen derselben Kennzahl sind derselbe Fehler wie zwei Format-E-Leser.

## Zug

1. **Eine Zaehlung**, in `retro-kpi.mjs`: `werkzeugNutzung(saetze)` liefert `toolUsage` im Format von
   `computeKpis`, nach `docs/KPI.md` (`graph_*` ÷ Grep + Glob + Doc-Read), plus drei ausgewiesene
   Extras: `graphReads` (Schreiben ersetzt kein grep), `volllaeufe`, `selektiv`.
   `fensterFuer(saetze, crId)` schneidet ab der ersten Nennung der ID bis zum Satz, der sie nach
   `docs/cr/done/` verschiebt.
2. **`messen.mjs` zaehlt nicht mehr selbst**: es waehlt das Fenster und stellt dar.
3. **`scripts/cr-messung.mjs`**: erkennt geschlossene CRs an der Umbenennung open → done, sucht jede
   Claude-Code-Sitzung des Repos, die die ID nennt, und schreibt eine Zeile je (CR, Sitzung) nach
   `.graphcode/cr-messung.jsonl`. Dazu `geloeschteDateien`: ob der CR ein Umbau war, die Variable,
   nach der sich die Reihe spaeter aufteilen laesst.
4. **`scripts/githooks/post-commit`**: startet die Messung im Hintergrund, wenn der Commit einen CR
   schliesst. Er kann nichts blockieren und soll auch nichts verzoegern.

## Zwei Definitionsfragen, die die Zahl veraendert haben

**`| grep` ist keine Suche.** `npm test | grep FAIL` filtert eine Ausgabe und fragt nichts ueber den
Code. Gezaehlt wird grep jetzt nur am Anfang einer Pipeline. Folge: der Referenz-Change hat **29**
Suchen, nicht 45. Die Grundlinie ist an allen fuenf Stellen korrigiert, an denen sie veroeffentlicht
war (Skill, Rig-README, Analyse, BOK-CR-068 samt Code-Kommentar), jeweils mit Fussnote statt
stillem Ueberschreiben.

**Das Fenster braucht ein Ende.** Die erste Fassung schnitt „ab der CR-ID bis zum Ende". Rueckwirkend
zaehlte CR-GC-630 so alles, was die Sitzung danach tat: **19 Volllaeufe statt 1**. Fuer den Hook war es
zufaellig richtig, er laeuft ja direkt nach dem Abschluss. Die fuenf falschen Zeilen dieses ersten
Laufs sind aus der Messdatei entfernt.

**Ein Abschluss hat zwei Formen, nicht eine.** Der erste Ausloeser hoerte nur auf die Umbenennung
`R docs/cr/open/X → docs/cr/done/X`. Beim Committen DIESES CR fiel auf, dass git kein R zeigte, sondern
`A docs/cr/done/X`: die Datei aus `dispatch prepare` lag nie eingecheckt in open/. Nachgezaehlt an den
acht Abschluessen vom 2026-09-23: **5 × A, 3 × R.** Der Ausloeser haette die Mehrheit verpasst. Jetzt
zaehlen beide Formen, im Skript und in der Vorpruefung des Hooks, mit rotem Test zuerst.

## Ergebnis: die ersten fuenf Datenpunkte

Rueckwirkend auf die CRs dieser Sitzung gemessen:

| CR | KPI 1 | Graph-Lesen | Suchen | Volllaeufe |
|---|---:|---:|---:|---:|
| CR-GC-630 | 0 | 0 | 12 | 1 |
| CR-GC-631 | 0,16 | 0 | 19 | 3 |
| CR-GC-632 | 0 | 0 | 4 | 4 |
| CR-GC-634 | 0 | 0 | 2 | 1 |
| CR-GC-635 | 0 | 0 | 21 | 2 |

**Fuenf von fuenf ohne einen einzigen Graph-Lesezugriff.** CR-635, der Skill, der das aendern soll,
ist selbst einer davon: er entstand vor seiner eigenen Wirkung.

## Grenzen, benannt

- **Keine Kontrollgruppe.** Die Reihe zeigt Verlaeufe, keine Ursachen. Was sie kann: vorher/nachher
  `se-umbau` (Commit `e2edc29`), aufgeteilt nach Umbau ja/nein. Das ist ein unterbrochener Zeitverlauf
  und schwaecher als ein Experiment, dafuer kostenlos und mit echter Streuung.
- **Ueberlappende Fenster.** Arbeitet eine Sitzung zwei CRs verschraenkt ab (630/631), zaehlt ein
  Aufruf fuer beide. Das Feld `fensterSaetze` macht die Ueberlappung sichtbar, loesen kann die
  Messung sie nicht.
- **Nur Claude Code.** OpenCode und andere Clients schreiben kein solches Protokoll. Die Messung
  schreibt dann eine Zeile mit `grund`, statt zu schweigen.
- **Nur dieses Repo.** Der Hook liegt in `scripts/githooks` von graphcode. Fuer die Familie waere es
  ein Rollout-Zug (bok), nicht Teil dieses CR.

## Tests

- `tests/retro-kpi.test.ts`: +4, rot zuerst (Zaehlung nach Definition, Fenster mit Ende, leeres
  Fenster ohne ID, eine Rechnung fuer KPI 1).
- `tests/cr-messung.test.ts` (neu): ein echtes Temp-Repo mit CR-Abschluss per `git mv`, ein
  Temp-Protokoll, gefahren wird der Hook-Pfad `--commit HEAD`. Eine zweite Sitzung ohne die ID wird
  nicht gemessen, ohne Protokoll entsteht eine Zeile mit Grund.
- Beide in `scripts/model-test-set.mjs` begruendet ausgeschlossen: sie nennen `docs/cr` bzw.
  `docs/graph` als Pfade, lesen die SSOT aber nie.

**Der eigentliche Smoke ist dieser Commit.** Er schliesst CR-GC-639 per Umbenennung, und der
post-commit misst ihn.
