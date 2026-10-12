# CR-GC-799: Testergebnis wird bei Aenderung nicht zurueckgenommen (FMEA FM-11, REQ-test-result-withdrawn-on-change)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-865 (bug)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-865.json (Lane: code)
**Quelle:** FMEA aller Wirkketten, CR-GC-798, FM-11 (S 8, O 5, D 7; höchstes Risiko im Modell)

---

## Befund

Ein Testergebnis am Modell gilt unbegrenzt. `graph_test_ingest` schreibt je Eintrag in `testRefs`
`result` und `ranAt` (`src/projections/testreport.ts:119-132`). Kein Leser wertet `ranAt` aus, und
nichts nimmt ein Ergebnis zurück, wenn der Test oder der geprüfte Code sich ändert. Die Regeln FM-03
(Risiko verifiziert) und VR-01 (Abnahme belegt) lesen nur `result`.

Gemessen am eigenen Modell, 2026-10-12: fünf der sechs Tests, die `graph_tests` für eine Änderung an
`FUNC-test-ingest` auswählt, tragen `passed` mit `ranAt` 2026-08-21. Dazwischen liegen sieben Wochen
und mehrere Umbauten an diesem Code.

## Zielbild

`REQ-test-result-withdrawn-on-change`: Betrifft eine gemeldete Änderung einen TEST-Knoten, nimmt das
Werkzeug das Ergebnis an seinen `testRefs` zurück. Ein Eintrag ohne Ergebnis gilt schon heute als
nicht bestanden (FM-03, VR-01). Es entsteht keine neue Regel und keine zweite Definition von
„bestanden"; der Regelkatalog (`@sigloch/contracts/se`) bleibt unberührt.

## Umfang

1. **Eingabe `changeSet` an `graph_test_ingest`** (Knoten-uids, dieselbe Form wie bei `graph_tests`),
   allein oder zusammen mit `report` oder `results`.
2. **Betroffene Tests** kommen aus `impactedTests()` (`src/kernel/measure/test-selection.ts:123`),
   derselben Funktion, die `graph_tests` und `verify:code` benutzen. Keine zweite Auswahl. Ein
   TEST-Knoten im `changeSet` ist selbst betroffen (geänderte Testdatei).
3. **Rücknahme:** an jedem `testRefs`-Eintrag eines betroffenen Tests entfallen `result`, `ranAt` und
   `evidence`, außer derselbe Aufruf liefert für die Datei ein frisches Ergebnis. Ein Kommando je
   Knoten, durch das Gate, mit Audit, wie der bestehende Ingest (CR-GC-386, CR-GC-232).
4. **Antwort:** nennt die zurückgenommenen Einträge (`withdrawn`: Test, Datei) neben `assignments` und
   `unresolved`. `dryRun` zeigt den Plan.
5. **Test zuerst:** `TEST-test-result-withdrawn-on-change` binden. Reproduktion auf einem Store auf
   Platte: Ergebnis einspielen, Änderung melden, Eintrag trägt kein Ergebnis, FM-03 meldet das Risiko;
   Gegenprobe: ein nicht betroffener Test behält sein Ergebnis.
6. **Werkzeugtext** (`description`, Hilfe) nennt die Rücknahme.

Dateien (geschätzt 5, Grenze 10): `src/projections/testreport.ts`,
`src/projections/verification-report.ts`, `src/projections/help-content.ts`, eine neue Testdatei,
`tests/testreport.test.ts`.

## Umfang laut `graph_impact` (graphVersion 722)

- `FUNC-test-ingest` (`src/projections/testreport.ts`, `graph_test_ingest`): Glied von
  `FCHAIN-test-ingest`; liest `FLOW-graph-state` (vom Store) und `FLOW-gate-verdict` (vom Gate).
- `graph_tests({changeSet: ["FUNC-test-ingest"]})`: sechs Dateien —
  `vitest run tests/contracts.surface.test.ts tests/mcp.realize.test.ts tests/mcp.tests-deduction.test.ts tests/mutate.formate-binding.test.ts tests/mutate.schema-guard.test.ts tests/testreport.test.ts`.
  Unaufgelöst: `TEST-test-result-withdrawn-on-change` (ungebunden, entsteht in diesem CR).

## Modell

- Der Ingest braucht die betroffene Menge im Aufruf. `FCHAIN-test-ingest` und `FCHAIN-impact-testing`
  teilen seit CR-GC-768 keinen Fluss. Mit diesem Bau ruft `FUNC-test-ingest` die Auswahl
  (`FUNC-resolve-tests-from-code`); der Fluss `SCHEMA-impacted-tests` an den Ingest und die Funktion als
  Glied der Kette gehören in denselben Zug (Leitsatz: worauf ein Glied synchron wartet, gehört zur
  Kette).

## Nicht im Umfang, benannt

- **Wer die Änderung meldet.** Nach diesem CR meldet sie der Aufrufer (Agent oder Skript). Nichts
  erzwingt den Aufruf: `verify:code` kennt die geänderten Dateien, hält aber keinen Store. Bis das
  entschieden ist, sinkt die Entdeckung (D), das Auftreten (O) bleibt. Entscheidung des Autors nach
  dem Bau.
- **Der Bestand.** Ergebnisse, die heute schon veraltet sind, nimmt dieser CR nicht pauschal zurück.
  Ein voller Lauf mit Rückmeldung (`npm test`, dann `graph_test_ingest`) stellt den Stand her.
- **Kein Zeitvergleich.** `ranAt` bleibt Auskunft; kein Leser entscheidet danach.
