# CR-GC-800: Spur CODE und Volllauf melden Aenderung und Lauf an graph_test_ingest zurueck (offen aus CR-GC-799)

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-872 (idea)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-872.json (Lane: code)

**Freigabe:** Autor, 2026-10-12 („die Änderungsmeldung aus CR 799 fertig machen"). Gebaut auf `master`
ohne Lane (Lokal-Modus).

---

## Befund

CR-GC-799 baute die Rücknahme veralteter Testergebnisse, ließ aber offen, wer die Änderung meldet.
Solange der Aufrufer daran denken muss, sinkt nur die Entdeckung des Risikos
`REQ-risk-stale-test-result` (FMEA CR-GC-798, FM-11), nicht sein Auftreten.

## Lösung

Die Meldung sitzt an der Stelle, die die Änderung ohnehin kennt: `verify:code` und `verify:full`.
Beide berechnen schon die geänderten Dateien und fahren den Lauf.

- **Datei auf Knoten:** `changeSetFor()` in `src/projections/test-selection-audit.ts`, dieselbe
  Abbildung wie die Testauswahl (`nodesForFile`). Eine geänderte Testdatei meldet die TEST-Knoten, die
  sie binden. Doku, Snapshot und Dateien ohne Knoten und ohne Modul melden nichts.
- **Meldung:** `scripts/aenderung-melden.mjs` ruft `graph_test_ingest` als MCP-stdio-Client, mit den
  Knoten und dem Bericht des Laufs. Läuft ein Host, reicht der gestartete Prozess als Proxy an ihn
  weiter; läuft keiner, gewinnt er die Wahl, schreibt und exportiert beim Abräumen. Kein zweiter
  Schreibweg, kein zweiter Transport.
- **Beide Spuren** schreiben den Bericht des Laufs als JSON und melden danach. `--plan` (der
  pre-commit-Hook) meldet nichts.
- **Scheitert die Meldung, endet der Lauf rot.** Ein grüner Lauf, dessen Ergebnis nicht ankommt, ist
  keiner.

## Modell (graphVersion 727 auf 731)

- Neu: `REQ-lane-reports-change` (Gegenmaßnahme, funktional, erfüllt von `FUNC-plan-code-lane`), als
  zweite Gegenmaßnahme unter `REQ-risk-stale-test-result`; `TEST-lane-reports-change`, gebunden an
  `tests/aenderungsmeldung.test.ts`.
- **Das Risiko hat damit zwei Träger** (`FUNC-test-ingest`, `FUNC-plan-code-lane`); die Fläche wächst von
  vier auf fünf Funktionen. Das ist die Folge von zwei Gegenmaßnahmen an zwei Orten, kein
  Zuordnungsfehler.
- Nicht modelliert: der Aufruf der Spur an das Werkzeug als Fluss. Die Spur spricht wie ein Agent über
  MCP-stdio; ein Skript ist im Modell kein Akteur.

## Ergebnis

- **Test:** `tests/aenderungsmeldung.test.ts`, sechs Fälle; der Fall über MCP-stdio fährt einen echten
  Host auf einem Store auf Platte. Test und Code sind in einem Zug entstanden, der rote Vorlauf fehlt.
- **Probe am eigenen Modell:** `npm run verify:code` meldete 37 Ergebnisse zurück, darunter ein rotes
  (die neue Testdatei fehlte in der Liste der Modell-Spur; in `scripts/model-test-set.mjs`
  nachgetragen).
- **Volllauf:** `npm run verify:full CR-GC-800`, 189 Dateien, 1588 Tests grün, Schlupf 0; zurückgemeldet
  137 Ergebnisse, 0 zurückgenommen, 52 Testdateien ohne TEST-Knoten.
- **`CLAUDE.md`**, Abschnitt Testdisziplin: ein Absatz zur Rückmeldung der Spuren.

## Benannt offen

- **Die Bewertung von FM-11** (S 8, O 5, D 7) ist nicht nachgezogen; das Urteil liegt beim Autor.
- **Kein Zwang zum Lauf.** Wer committet, ohne eine Spur zu fahren, meldet nichts; der pre-commit-Hook
  fährt nur die Modell-Spur im Planmodus der CODE-Spur. CI meldet nicht zurück (kein Store).
- **Knoten nur im Snapshot.** Die Knoten kommen aus dem committeten Snapshot; fehlt einer im Store, weist
  das Werkzeug die Meldung ab und die Spur endet rot.
- **52 Testdateien ohne TEST-Knoten** tragen kein Ergebnis im Modell.
