# CR-GC-845: conformanceViolations löschen

**Status:** ✅ Done (2026-10-23)
**Typ:** aus Item ITEM-2026-1036 (finding)
**Erstellt:** 2026-10-23
**Item:** bok/items/ITEM-2026-1036.json (Lane: code)

---

## Befund

`conformanceViolations(harness)` gab nur `conformanceEvaluation(harness).violations` zurück. Kein Produktionscode rief es, nur `tests/conformance.test.ts` (15 Stellen). CR-GC-843 hat die Bindung von FUNC-check-code-conformance schon auf `conformanceEvaluation` gesetzt. Der Wrapper war damit ein zweiter Pfad zur selben Frage.

## Änderung

- `src/kernel/conformance.ts`: `conformanceViolations` gelöscht, Kopfkommentar und Schlusskommentar nennen `conformanceEvaluation`.
- `tests/conformance.test.ts`: alle Aufrufe auf `conformanceEvaluation(...).violations` umgestellt.

Kein Modellzug: kein Knoten bindet `conformanceViolations`. `tests/fixtures/perf-basis.graph.json` nennt den Namen weiter; die Datei ist ein eingefrorener Modellstand für den Laufzeit-Spike und wird nicht gegen den Code geprüft.

## Umfang laut `graph_impact`

- `graph_impact(FUNC-check-code-conformance)`: Bindung bleibt `conformanceEvaluation`, keine Kante ändert sich.
- `graph_tests({changeSet:[FUNC-check-code-conformance]})`: `vitest run tests/conformance.test.ts`.
- Aufrufer außerhalb: keiner in sigloch-modules und gve; kein `exports`-Pfad trägt den Namen.

## Prüfung

- `npm run type-check` grün.
- `tests/conformance.test.ts` grün; der Test ruft jetzt die Funktion, die `evaluateAll` ruft.
- `npm run verify:full CR-GC-845`.

## Akzeptanz

- `grep -rn conformanceViolations src tests/*.ts` findet nichts.
- Volllauf grün.
