# CR-GC-1025: Aufrufvertrag als ein Objekt: crGroups, impactedTests, zugBericht weichen vom Anfrage-SCHEMA ab (aus CR-GC-1024)

**Typ:** aus Item ITEM-2026-1651 (bug)
**Erstellt:** 2026-11-24
**Item:** bok/items/ITEM-2026-1651.json (Lane: code)

---

## Befund

CR-GC-1024 hat für jede FUNC einen Kopf aus dem Modell erzeugt und mit dem Typprüfer gegen den Code gebunden. An drei FUNC widerspricht der Code dem Anfrage-SCHEMA, und keine Regel meldet es:

| FUNC | Anfrage-FLOW → SCHEMA | Code |
|---|---|---|
| `FUNC-cr-groups` | `FLOW-cr-groups-request` → `SCHEMA-cr-groups` (`CrGroupsSchema`, das ist die Antwort) | `crGroups(graph, crIds)` |
| `FUNC-select-tests` | `FLOW-select-request`, `FLOW-select-request-lane` → `SCHEMA-ontology-graph` (`elements`/`traces`) | `impactedTests(graph: Graph, changeSet, depth = 4)`, `Graph` hat `nodes`/`edges` |
| `FUNC-zug-bericht` | `FLOW-zug-anfrage`, `FLOW-zug-anfrage-suggest` → `SCHEMA-ontology-graph` | `zugBericht(before, after, policy, opts)`, Fehlerfall `BerichtFehlt` ohne SCHEMA |

Das Anfrage-SCHEMA ist der Aufrufvertrag und trägt alle Eingaben als Felder. CR-GC-1022 hat das für `generationStep` umgesetzt.

## Schnitt

Alle drei FUNC berühren 15 Dateien, mehr als die Grenze von 10. Ein Schnitt je FUNC lässt keinen Aufrufer rot stehen, die Ausnahme der Dateigrenze greift also nicht. Dieser CR nimmt `crGroups` und `impactedTests`. `zugBericht` samt Fehlerfall folgt in einem eigenen CR aus ITEM-2026-1653.

## Zug

1. `CrGroupsAnfrageSchema` in `src/loop/se-plan.ts`: `{ graph: GraphSchema, crIds: string[] }`. `crGroups(anfrage)` parst es beim Eintritt und rechnet auf dem Original des Graphen, wie `generationStep`.
2. `TestImpactAnfrageSchema` in `src/kernel/measure/test-selection.ts`: `{ graph: GraphSchema, changeSet: string[], depth: number = 4 }`. `impactedTests(anfrage)` ebenso.
3. Alle Aufrufer ziehen um: `src/projections/graphcode.ts`, `src/kernel/harness.ts`, `src/projections/test-selection-audit.ts` (zwei Stellen), `tests/se-plan.groups.test.ts`, `tests/test-selection.audit.test.ts`. Die alte Signatur entfällt.
4. Modell durch das Gate (`se-umbau`):
   - neu `SCHEMA-cr-groups-anfrage` (`realRef` auf `CrGroupsAnfrageSchema`); `FLOW-cr-groups-request` hängt daran statt an `SCHEMA-cr-groups`; `SCHEMA-cr-groups` beschreibt nur noch die Antwort.
   - neu `SCHEMA-test-impact-anfrage` (`realRef` auf `TestImpactAnfrageSchema`); `FLOW-select-request` und `FLOW-select-request-lane` hängen daran statt an `SCHEMA-ontology-graph`.
   - Namen von `FUNC-cr-groups` und `FUNC-select-tests` nennen die neue Signatur.
5. Vertragstests aus `graphcode vertragstest` für beide neuen SCHEMA, je ein TEST-Knoten mit `verify`.

## Dateien (10)

`src/loop/se-plan.ts`, `src/projections/graphcode.ts`, `src/kernel/measure/test-selection.ts`, `src/kernel/harness.ts`, `src/projections/test-selection-audit.ts`, `tests/se-plan.groups.test.ts`, `tests/test-selection.audit.test.ts`, `tests/vertrag/SCHEMA-cr-groups-anfrage.vertrag.test.ts`, `tests/vertrag/SCHEMA-test-impact-anfrage.vertrag.test.ts`, diese CR-Datei.

## Abnahme

- Kein Aufruf mit Positionsargumenten von `crGroups` oder `impactedTests` in `src/`, `tests/`, `scripts/`.
- Die Typbindung aus CR-GC-1024 (`kopf.mjs`, Variante 2b) ist für `FUNC-cr-groups` und `FUNC-select-tests` grün.
- R-26, R-32 und RC-04 nennen die beiden neuen SCHEMA nicht.
- Die Vertragstests werden rot, wenn das Schema geschwächt wird (Generator-Eigenschaft aus CR-GC-962).
- `verify:code` grün.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1601, Tiefe 1, Wurzeln: `FLOW-cr-groups-request`, `FLOW-select-request`, `FLOW-select-request-lane`, `FLOW-zug-anfrage`, `FLOW-zug-anfrage-suggest`._

Reichweite: 10 Elemente (FLOW 5, FUNC 5); Blackbox-Rand 27, nicht geoeffnet.

Dateien (realRef, 5):
- src/kernel/harness.ts
- src/loop/suggest.ts
- src/projections/exporter.ts
- src/projections/test-selection-audit.ts
- src/surface/write.ts

Tests (`graph_tests`, 3):
- tests/se-plan.groups.test.ts
- tests/vertrag/SCHEMA-cr-groups.vertrag.test.ts
- tests/vertrag/SCHEMA-ontology-graph.vertrag.test.ts

`graph_impact(SCHEMA-cr-groups)`: 2 FLOW, 2 TEST (`TEST-se-plan-groups`, `TEST-vertrag-cr-groups`), 2 CR. `graph_impact(SCHEMA-ontology-graph)`: 26 FLOW; dieser CR hängt nur `FLOW-select-request` und `FLOW-select-request-lane` um. `suggest.ts`, `write.ts` und `exporter.ts` betreffen `zugBericht` und gehören zum Folge-CR.
