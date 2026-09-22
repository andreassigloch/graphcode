# CR-GC-608: Fertig-Kriterium der Steuerregeln: lokales Optimum bei Kreis oder Plateau ueber 3 Steuerzuege (opus5-11/13/15)

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-469 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-469.json (Lane: graph)

---

## Befund

Steuerregeln (RD-04, BW-02, R-04, CR-01, MT-02) hatten kein Ende ausser `done` bei Ueberschuss 0.
opus5-11: R-04 sechsmal ohne Bewegung. opus5-13: graph_suggest ohne anwendbaren Zug fuer R-04/BW-02/CR-01.
opus5-15: der R-04-Tausch erzeugte den CR-01-Ueberschuss, die Abbruchregel stellte CR-01 zurueck — Ende
`stalled` ("uebergib an den Menschen") statt eines Ergebnisses.

## Entscheidung (2026-09-22, wie vorgeschlagen)

Lokales Optimum (Abbruchkriterium der lokalen Suche, Tabu-Gedaechtnis), k = 3, ε = 0,05:
- **Kreis:** der Termvektor nimmt einen Zustand der letzten k Steuerzuege wieder an (A → B → A);
- **Plateau:** der Steuerwert sinkt ueber k Steuerzuege um weniger als ε.
Folge: Steuerregeln verlassen den Kern-Fokus, `done` mit Vermerk der Terme — nie `stalled`.

**Kein anwendbarer Zug** ist nicht separat geprueft: ohne anwendbaren Zug sinkt der Wert nicht, das
Plateau greift nach k Zuegen. Ein eigener Check kostete nach jedem Zug einen Dry-Run je graph_suggest-
Kandidat.

## Aenderung

- `stagnation.ts`: `lokalesOptimum()` (rein), Steuerverlauf im Sitzungsgedaechtnis — gezaehlt nur Zuege
  bei Steuerregel-Fokus; Steuerregeln von der Abbruchregel (CR-GC-606) ausgenommen; ein neuer Anstieg
  ueber das Optimum oeffnet sie wieder.
- `generate.ts`: Schritt traegt `steer` (aus se-engine `steerTerms`); am Optimum ohne Steuerregeln im
  Kern-Fokus; `steuerVermerk()` im done-Prompt.
- `suggest.ts`, `next-step.ts`: Optimum an die Maschine durchgereicht.
- `decisions.ts` + `se:generate`: Satz `steerOptimum` wortgleich; stalled-Satz ergaenzt.
- `scripts/model-test-set.mjs`: begruendeter Ausschluss des neuen Tests.

8 Dateien statt 6 — bewusst nicht gesplittet (Nutzerentscheidung 2026-09-22).

## Test

`tests/steer-optimum.test.ts` (Kreis, Plateau, Verbesserung, nur Steuerzuege zaehlen, keine Zurueckstellung
von Steuerfokus, Golden ohne Steuerregel im Fokus am Optimum, Vermerk). Rewind ab opus5-15 vor dem R-04-Tausch.


---

## Abschluss 2026-09-22 — nachgeprueft, nicht nachgebaut

Der Code lag bereits auf master (Commit `b3d58aa`, parallele Sitzung); offen war nur die Datei in
`docs/cr/open/`. Gegen die CR-Liste nachgeprueft, alles vorhanden:

| aus der CR | wo |
|---|---|
| `lokalesOptimum()` rein, Steuerverlauf im Sitzungsgedaechtnis, Steuerregeln von der Abbruchregel ausgenommen | `src/loop/stagnation.ts` (`STEUER_FENSTER = 3`, `STEUER_EPS = 0.05`) |
| Schritt traegt `steer`, am Optimum keine Steuerregel im Kern-Fokus, `steuerVermerk()` im done-Prompt | `src/loop/generate.ts` |
| Optimum an die Maschine durchgereicht | `src/loop/suggest.ts`, `src/loop/next-step.ts` (beide ueber `stepWithMemory`) |
| Satz `steerOptimum` wortgleich | `src/loop/decisions.ts` + `.claude/commands/se/generate.md` §6 |
| begruendeter Ausschluss des neuen Tests | `scripts/model-test-set.mjs` |

`tests/steer-optimum.test.ts`: **10 von 10 gruen** und deckt jeden in der CR genannten Fall —
Kreis, Plateau, echte Verbesserung, nur Steuerzuege zaehlen, keine Zurueckstellung eines
Steuerfokus, am Golden kein Steuerfokus mehr am Optimum, und der Vermerk im done-Prompt.
