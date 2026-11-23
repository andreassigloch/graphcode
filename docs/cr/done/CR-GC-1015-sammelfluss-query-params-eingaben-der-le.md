# CR-GC-1015: Sammelfluss query-params: Eingaben der Lesewerkzeuge ohne eigenen Vertrag

**Typ:** aus Item ITEM-2026-1619 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1619.json (Lane: code)

---

## Befund

Fortsetzung von CR-GC-1014. `FLOW-query-request-agent` führt mit `SCHEMA-query-params` auch zu `FUNC-read-tools`, das sechs Werkzeuge mit sechs Eingabeformen trägt: graph_elements, graph_get_node, graph_get_edges, graph_impact, graph_expand und graph_context. Die Eingabeschemas in `src/surface/read.ts` waren nicht exportiert. Geparst hat sie nur das MCP-SDK.

## Zug

1. In `src/surface/read.ts` werden die sechs Eingabeschemas exportiert. Jeder Handler parst seine Eingabe selbst.
2. Modell: je Werkzeug ein FLOW `FLOW-<werkzeug>-call` von `FUNC-agent-loop` zu `FUNC-read-tools` mit eigenem SCHEMA (FAQ `flow-ein-schema` Punkt 6). Die io-Kante von `FLOW-query-request-agent` zu `FUNC-read-tools` entfällt.
3. Je SCHEMA ein erzeugter Vertragstest.
4. `tests/arch.optimization-dry-run.spike.test.ts` nach seiner Pflegeregel neu gemessen.

## Folge für die Kennzahlen

Der Steuerwert geht von 11,00 auf 12,50. Grounding trägt 54 Verträge an seiner Grenze statt 48. Der Sammelfluss hatte sie als einen gezählt.

## Abnahme

- R-32 nennt keines der sechs neuen SCHEMA.
- Die Vertragstests sind grün. Die Gegenprobe ohne `nonnegative` an `depth` von graph_impact macht 1 Fall rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1558, Tiefe 1, Wurzeln: `FLOW-query-request-agent`, `FUNC-read-tools`._

Reichweite: 9 Elemente (FLOW 6, FUNC 3); Blackbox-Rand 57, nicht geoeffnet.

Dateien (realRef, 2):
- src/kernel/harness.ts
- src/surface/read.ts

Tests (`graph_tests`, 8):
- tests/mcp.impact.test.ts
- tests/mcp.mutate-input.test.ts
- tests/tool-context.test.ts
- tests/tool-contract.test.ts
- tests/vertrag/SCHEMA-format-e.vertrag.test.ts
- tests/vertrag/SCHEMA-impact-slice.vertrag.test.ts
- tests/vertrag/SCHEMA-ontology-graph.vertrag.test.ts
- tests/vertrag/SCHEMA-tool-context.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
