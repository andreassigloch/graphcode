# CR-GC-1014: Sammelfluss query-params: Eingaben der Bericht-Werkzeuge ohne eigenen Vertrag

**Typ:** aus Item ITEM-2026-1618 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1618.json (Lane: code)

---

## Befund

`SCHEMA-query-params` ist ein Sammelknoten ohne Code: 23 Flüsse tragen ihn, und im Code hat jeder Aufruf seine eigene Eingabe. `FLOW-query-request-agent` führt von der Ablaufsteuerung zu 13 Werkzeugen mit 20 verschiedenen Eingabeschemas. FAQ `flow-ein-schema` Punkt 6 verlangt einen FLOW je Verbindung und Form.
Die Eingabeschemas der Werkzeuge waren nicht exportiert. Geparst hat sie nur das MCP-SDK über `strengesSchema`, und diesen Helfer sieht RC-04 nicht. Deshalb meldet RC-04 auch `SCHEMA-test-ingest-input`.

Dieser CR ist der erste von mehreren. Er nimmt die Werkzeuge aus `src/projections/report.ts` und `graph_test_ingest`.

## Zug

1. In `src/projections/report.ts` werden sechs Eingabeschemas exportiert: rules_evaluate, rules_get_violations, graph_readiness, graph_tests, graph_help, graph_authoring_guide. Jeder Handler parst seine Eingabe selbst. Der Helfer `detailOf` entfällt, weil der Parse den Default `full` setzt.
2. Der Handler von `graph_test_ingest` parst `GraphTestIngestInputSchema`.
3. Modell: Je Werkzeug gibt es einen FLOW `FLOW-<werkzeug>-call` von `FUNC-agent-loop` mit eigenem SCHEMA. Für `graph_test_ingest` kommt `FLOW-test-ingest-call-agent` dazu, auf dem bestehenden `SCHEMA-test-ingest-input`. Die io-Kanten von `FLOW-query-request-agent` zu diesen sechs FUNC entfallen.
4. Je neuem SCHEMA ein erzeugter Vertragstest.

## Folge für die Kennzahlen

Die Grenzbreite steigt (R-04, BW-02, CR-01), und der Steuerwert geht von 9,50 auf 11,00. Der Sammelfluss hatte sechs Verträge als einen gezählt. Erst der korrigierte Stand ist messbar (FAQ `modellfehler-vor-architekturkennzahl`).

## Abnahme

- R-32 nennt keines der sechs neuen SCHEMA.
- RC-04 nennt `SCHEMA-test-ingest-input` nicht mehr.
- Die Vertragstests sind grün. Die Gegenprobe ohne `.min(1)` an `changeSet` macht 1 Fall rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1553, Tiefe 1, Wurzeln: `FLOW-query-request-agent`, `SCHEMA-query-params`._

Reichweite: 24 Elemente (FLOW 23, FUNC 1); Blackbox-Rand 64, nicht geoeffnet.

Dateien (realRef, 3):
- src/kernel/own-kuzu.ts
- src/surface/host-shim.ts
- src/surface/import-code-verb.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
