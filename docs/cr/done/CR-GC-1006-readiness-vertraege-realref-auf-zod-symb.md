# CR-GC-1006: Readiness-Vertraege: realRef auf Zod-Symbole, Parse beim Erzeuger, wrappedSymbols

**Typ:** aus Item ITEM-2026-1592 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1592.json (Lane: graph)

---

Folge von CR-SM-448 (Zod-Schemas für Readiness in graphcode-client 3.3.0) und CR-SM-449 (RC-04 liest `wrappedSymbols`, contracts 12.17.0). Übergabe-Punkte 1, 2, 4, 5 (Punkt 3, der Floor, steht in CR-GC-1005).

## Änderung

- Modell: `realRef` von `SCHEMA-readiness-report` auf `packages/graphcode-client/src/readiness.ts`, Symbol `ReadinessReportSchema` (vorher `ReadinessReport` in contracts, dort seit CR-SM-401 entfernt). `realRef` von `SCHEMA-completeness` auf Symbol `ReadinessMarkSchema` (vorher der Typ). Beschreibung von `SCHEMA-readiness-report` auf den heutigen Bericht gebracht. CR-Knoten mit Kanten auf beide SCHEMA und beide FUNC.
- `src/kernel/evaluation.ts`: `readinessOf` parst den Bericht mit `ReadinessReportSchema.parse` dort, wo er entsteht (FAQ `erzeuger-parst-vertrag`, Punkt 4), und gibt das Original zurück. Statt im Handler von `graph_readiness`, wie CR-SM-448 es nennt: `readinessOf` ist die FUNC mit dem Bericht als Ausgabe, und `verlauf.ts` erzeugt ihn auf demselben Weg.
- `src/kernel/measure/readiness.ts`: Re-Export von `ReadinessReportSchema`.
- `src/kernel/conformance.ts`: `parseFileFacts` füllt `wrappedSymbols` (Vorschrift CR-SM-449).
- `scripts/model-test-set.mjs`: die neue Testdatei steht in der Modell-Spur.
- Tests (rot zuerst): `tests/conformance.wrapped-symbols.test.ts` (echter Quelltext: `metrics.ts`, `config.ts`, `format-e-commands.ts`), `tests/readiness.erzeuger-parst.test.ts` (der Parse in `readinessOf` abgeschaltet: der Fall mit unbekannter Schwere wird rot).

## Messung

`rules_evaluate`, Host mit dem neuen Build, vor und nach der Modelländerung:

| Regel | vorher | nach `wrappedSymbols` | nach Modell und Parse |
|---|---|---|---|
| RC-04 | 15 | 11 (`metric-policy`, `chain-metrics`, `function-criticality`, `module-metrics` weg) | 10 (zusätzlich `readiness-report` weg; `completeness` bleibt, anderes Symbol) |

RC-09 bleibt bei seiner Zahl. R-32 an beiden SCHEMA bleibt bis CR-GC-1007.

## Offen für den Autor

`SCHEMA-completeness` bleibt bei RC-04: `readinessOf` parst `ReadinessReportSchema`, das die Marken enthält, aber der Extraktor sieht `ReadinessMarkSchema` nur, wenn es im Initializer eines Schemas derselben Datei steht. CR-SM-448 Punkt 4 nahm an, der Parse des Berichts decke es mit ab. Das tut er nicht. Ein Parse der Marken allein (`const MarkenSchema = z.array(ReadinessMarkSchema)`, `MarkenSchema.parse(bericht.marks)`) wäre doppelt zum Berichtsparse. Nicht gebaut.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wo parst der Erzeuger den Bericht? | In `readinessOf`, nicht im Handler. | FAQ `erzeuger-parst-vertrag`: dorthin, wo das Objekt entsteht. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1517, Tiefe 1, Wurzeln: `SCHEMA-readiness-report`, `SCHEMA-completeness`, `FUNC-compute-readiness`, `FUNC-graph-readiness`._

Reichweite: 19 Elemente (FLOW 15, FUNC 4); Blackbox-Rand 12, nicht geoeffnet.

Dateien (realRef, 6):
- packages/contracts/src/se/readiness.ts
- packages/graphcode-client/src/readiness.ts
- src/kernel/evaluation.ts
- src/kernel/harness.ts
- src/projections/report.ts
- src/surface/host-shim.ts

Tests (`graph_tests`, 10):
- tests/harness.import-rejected-traces.test.ts
- tests/mcp.readiness.test.ts
- tests/mutate.schema-guard.test.ts
- tests/readiness.model.test.ts
- tests/target-profile.test.ts
- tests/verlauf.test.ts
- tests/vertrag/SCHEMA-ontology-graph.vertrag.test.ts
- tests/vertrag/SCHEMA-rule-violation.vertrag.test.ts
- tests/vertrag/SCHEMA-work-set.vertrag.test.ts
- tests/views.auditor.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
