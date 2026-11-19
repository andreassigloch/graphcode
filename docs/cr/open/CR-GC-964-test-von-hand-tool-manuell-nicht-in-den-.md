# CR-GC-964: Test von Hand — nicht im vitest-Lauf, Ergebnis mit Protokoll

**Typ:** aus Item ITEM-2026-1479 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1479.json (Lane: graph)
**Status:** Open
**Herkunft:** CR-GC-961 F3 Variante d und F3.2 (Folge 3); CR-SM-443 (Regeln nehmen Vertragsdatei und Testdatei von Hand schon an)

---

## Befund

Ein Test von Hand ist nach CR-GC-961 F3d eine Testbeschreibung im Repo, z. B. `tests/manuell/hebel.md`, gebunden mit `testRefs [{file, tool: "manuell"}]`. Gemessen am Code vor diesem CR:

- `graph_tests` und die Code-Spur nahmen jede gebundene Datei in den `vitest run`-Befehl, auch eine `.md`. vitest hätte die Testbeschreibung als Testdatei gefahren.
- `graph_test_ingest` nahm `results: [{file, result, tool}]` an, aber kein Protokoll. Das Feld `evidence` am `testRefs`-Eintrag gibt es in contracts schon, niemand schrieb es.
- Die Bindung über den Kopf (CR-GC-901) liest auch eine Markdown-Überschrift (`# Hebeltest (TEST-hebel)`).
- Die Rücknahme bei Änderung (CR-GC-961 F3.2) gibt es schon: `graph_test_ingest({changeSet: [SCHEMA-uid]})` nimmt das Ergebnis jedes TEST zurück, der das SCHEMA prüft (CR-GC-799). Der Test dieses CR belegt das für einen Test von Hand.

## Änderung

| Datei | Was |
|---|---|
| `src/kernel/measure/test-selection.ts` | Konstante `MANUELL = 'manuell'`; `TestSelectionSchema.manuell`, `CodeLanePlanSchema.manuell` |
| `src/projections/report.ts` | `graph_tests` legt Bindungen mit Werkzeug `manuell` unter `manuell` ab, nie in `command`; der Werkzeugtyp ist `TestSelection` aus dem Schema statt einer zweiten Deklaration |
| `src/projections/test-selection-audit.ts` | `testFilesOf` und die Code-Spur trennen dasselbe; die Spur nennt jeden TEST „von Hand fällig“ |
| `src/projections/testreport.ts`, `src/projections/verification-report.ts` | `results[].evidence` (Pfad des Protokolls) wird mit Ergebnis und `ranAt` geschrieben; ein neuer Lauf ohne Protokoll löscht das alte |
| `tests/test-von-hand.test.ts` | neu, Disk-Kuzu im tmp-Repo; 2 von 3 Fällen vor der Änderung rot gesehen, der dritte (Rücknahme) war schon grün |

Modell: `REQ-test-von-hand-auswahl` (FUNC-deduce-tests), `REQ-test-von-hand-spur` (FUNC-plan-code-lane), `REQ-test-von-hand-ergebnis` (FUNC-test-ingest), alle drei geprüft von `TEST-test-von-hand`.

## Ablauf eines Tests von Hand (für Skills und Projekte)

1. Testbeschreibung `tests/manuell/<name>.md`, Überschrift mit TEST-uid, Schritte, Kriterium „bestanden, wenn …“.
2. Durchführung, Protokoll als Datei (Prüfer als Rolle, Messwerte, Ergebnis).
3. `graph_test_ingest({results: [{file, result, tool: "manuell", evidence: <Protokoll>}]})` — bindet beim ersten Lauf über die Überschrift.
4. Ändert sich der Vertrag: `graph_test_ingest({changeSet: [<SCHEMA-uid>]})` nimmt das Ergebnis zurück; `graph_tests` nennt den TEST wieder unter `manuell`.

## Akzeptanzkriterien

- [ ] `tests/test-von-hand.test.ts` grün, vorher rot gesehen.
- [ ] Die Tests der Auswahl und des Ingest grün (`verify:code`).
- [ ] `verify:full CR-GC-964` grün.


---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Woran erkennt die Auswahl einen Test von Hand? | Werkzeug `manuell` am `testRefs`-Eintrag, eine Konstante in `test-selection.ts` | Das Werkzeug sagt, wer den Lauf fährt; eine Dateiendung wäre eine zweite Regel. Gleiche Erkennung wie R-19 in CR-SM-443. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1326, Tiefe 1, Wurzeln: `FUNC-deduce-tests`._

Reichweite: 4 Elemente (FLOW 2, FUNC 2); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 1):
- src/projections/report.ts

Tests (`graph_tests`, 3):
- tests/mcp.tests-deduction.test.ts
- tests/mvp-e2e.test.ts
- tests/test-selection.audit.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
