# CR-GC-742: Rig-Simulator: je Anliegen des Agenten eine Antwort, Politik je Aufgabe, Entscheidungen im Protokoll

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-749 (finding)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-749.json (Lane: code)

---

## Befund

Der Nutzer-Simulator kannte eine Sprechhandlung: auf jede Frage das ganze Antwortblatt plus „als offen führen", danach
graphcodes Vorschlag. Zwei Läufe der Stufe `warnungsfrei` (2026-10-05, Basis Referenzlauf todo/lokal) zeigen die Folge:

- **lokal-1, Zug 1 → 2:** der Agent fragte „`FLOW-ausgabe` löschen oder Produzent anhängen?". Antwort: das Blatt (trifft
  die Frage nicht), „offen führen" und der Vorschlag „Vervollständige die Datenflüsse Terminal-Ausgabe". 66 000 Zeichen
  Denken, Ausgabelimit, 9,4 min ohne Zug.
- **frontier-1, Zug 1 → 7:** der Agent fragte „welche der fünf Analysen soll ich durchführen, welche nehme ich ab?".
  Antwort: der Reihe nach alle fünf Analyse-Vorschläge. Warnungen 5 → 18 (17× CR-R03 aus Bauplan-CRs, 1× FM-03).
- Die Freigabe-Bitte ging raus, sobald graphcode sie vorschlug — bei 5 bzw. 18 Warnungen; das Stufenziel zählte zudem
  mit Grund abgenommene Funde als offen (`rules_evaluate` zeigt sie unverändert, ITEM-2026-748).
- Dabei aufgefallen: frontier-1 maß einen veralteten Export (v4 gegen Audit v10, `EXPORT_PENDING`).

## Umsetzung

- `rig/simulator.mjs`: `fragen` trennt Verfahrensfragen („Soll ich weitermachen?") von Fragen zum Inhalt — eine
  Zustimmung zu Inhalt wäre eine Vorgabe. `frageArt`: `analyse` (Politik antwortet) · `blatt` (Stichwort-Treffer im
  Antwortblatt) · `modell` (nennt uids oder Modellbegriffe → „deine Entscheidung") · `wissen` (ohne Treffer → offen).
  `naechsteNachricht`: erste Wissensrunde je Sitzung das ganze Blatt (wie im Handlauf), danach je Frage die Zeile;
  Antworten vor graphcodes Vorschlag in einer Nachricht — außer der Agent wartet auf eine Entscheidung (Modell,
  Analysen): dann bleibt der Vorschlag den Zug liegen. Nachgerechnet an der Serie 2026-10-05: 42 von 45 Vorschlägen
  gehen weiter raus. Jede Entscheidung als `{ art, … }` im Ergebnis.
- Politik je Aufgabe (`aufgabe.json`, Vorgabe wie im Handlauf): `analysen: folgen | ablehnen`, `freigabe: immer |
  bei-ziel`. `zielText` nennt dem Agenten, was dem Stufenziel fehlt („noch 3 offene Warnungen: CR-R02 ×2, R-10").
- Antwortblatt: Zeilen `- [stichworte] Antwort`; `blattLesen` liefert den Text ohne Stichworte (Nutzer, Gutachter).
- `auswertung/nachspielen.mjs`: `befundAus` — offene Warnungen ohne die mit Grund abgenommenen (contracts
  `acceptedRuleIds`), mit Liste `offen` und Zahl `abgenommen`; Ziel `warnungsfrei` prüft darauf.
- `rig/treiber.mjs`: Entscheidung des Simulators je Zug im Protokoll (`simulator`) und in der Konsolenzeile; Befund
  vorab bei Läufen mit Basis; Ende `stillstand` nach vier Zügen ohne angenommene Mutation; Sitzungswechsel nach dem
  abgeschickten Vorschlag. **Export:** wartet den letzten Host ab und vergleicht Export- mit Audit-Version; sonst
  `graph.json` aus dem Audit (`graphQuelle: nachspiel`). `stand()` zählt `docs/` nicht (die Auswertung schreibt dort).
- `auswertung/kennzahlen.mjs`: `simulator` (Entscheidungen je Art), `warnungenEnde`.
- Aufgaben: `todo-warnungsfrei` (Politik ablehnen / bei-ziel; Start-Prompt nennt nur `rules_evaluate` — `graph_readiness`
  hat kein Arm), neu `todo-hand-warnungsfrei` (Basis: Handlauf des Autors aus todo-local, eingefroren, sha256/12
  `ffca175c9c62`: Einsatzkonzept, Variantenvergleich, Annahmen-Review gemacht).
- Nachtrag am Datensatz `todo-warnungsfrei/frontier-1`: `graph.json` aus dem Audit nachgebaut (68/154), Export v4 als
  `graph.export-v4.json` daneben.

## Verifikation

- `tests/rig-interaktiv.test.ts`: Fragetypen und Blatt; die beiden echten Fragen aus lokal-1 und frontier-1 als
  Fixtures; Politik am Vorschlag; `zielText`; Stillstand. `tests/auswertung.test.ts`: `befundAus`, Befund auf der Basis.
- `npm run verify:full CR-GC-742` (2026-10-05): 202 Dateien, 1766 Tests grün; Spur CODE, Auswahl 52/202, Schlupf 0 (Folge 4/10).
- Wiederholung der Läufe mit dem neuen Simulator: Serie todo (3 × lokal, 3 × frontier), `todo-warnungsfrei` und
  `todo-hand-warnungsfrei` je lokal und frontier — Ergebnis in `docs/messung/benchmark.md`.
