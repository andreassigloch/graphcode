# CR-GC-609: Schatten-graph_suggest im Rig: je Zug nachgespielt, was der Optimierer vorgeschlagen haette — opus5-14/15: 0 anwendbare Vorschlaege, keine Vorlage fuer Steuerregeln

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-470 (finding)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-470.json (Lane: graph)

---

## Befund

`graph_suggest` ist nicht abgeschaltet: im Executor wird es seit CR-GC-556 je Runde injiziert. In den
Claude-Code-Laeufen ruft der Agent es nie — se:generate verweist erst beim Handoff darauf, und der wartet
auf ein Zielprofil vom Menschen. Der Kanal war damit ungemessen, obwohl er das Werkzeug ist, an dem sich
die Steuerung selbst verbessern laesst (Auftraggeber 2026-09-22).

## Aenderung

- `rig/greenfield-systemtest/schatten-suggest.mjs` (neu): spielt die angewandten Zuege eines Laufs im
  Wegwerf-Arbeitsbereich durchs heutige Gate nach, fragt VOR jedem Zug graph_suggest (k 20), misst den
  Steuerwert vor/nach dem Zug des Agenten; schreibt `<lauf>/schatten-suggest.json`.
- `report.mjs`: Abschnitt "Schatten-graph_suggest", wo die Datei existiert.
- `tests/systemtest-rig.test.ts`: Zugauswahl, Beruehrung, Bilanz, Berichtszeile.

## Erstes Ergebnis

| Lauf | Zuege | Steuerwert max | anwendbare Vorschlaege |
|---|---:|---:|---:|
| opus5-14 | 29 | 3,5 | 0 |
| opus5-15 | 34 | 2,33 | 0 |

Root Cause: die Fix-Vorlagen in se-engine (`FIX_TEMPLATES`) decken CR-R01, R-02, RD-01, R-31, R-30, R-22,
R-23, SC-02, R-18, MS-03, UC-02 ab — keine der fuenf Steuerregeln (RD-04, BW-02, R-04, CR-01, MT-02).
Die Steuerzuege (Modultausch, Zwischenebene) hat der Agent selbst per Dry-Run-Vergleich gefunden
(opus5-15 Zug 69/70, 73/74). Folge-Item: Operatoren fuer Steuerregeln in se-engine; dieser Schatten misst
dann, ob sie die Wahl des Agenten treffen oder schlagen.

