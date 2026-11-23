# CR-GC-1016: Sammelfluss query-params: Eingaben von export, metrics, suggest, generate ohne eigenen Vertrag

**Typ:** aus Item ITEM-2026-1620 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1620.json (Lane: code)

---

## Befund

Fortsetzung von CR-GC-1014 und CR-GC-1015. An `SCHEMA-query-params` hängen noch:

- `FLOW-query-request-agent` zu graph_export, graph_metrics und graph_suggest.
- `FLOW-steering-trigger-agent`, der Agent ruft graph_generate.
- `FLOW-export-request-import-code` und `FLOW-query-request-auto-export`. Beide rufen den Handler von graph_export mit dessen Eingabe.
- `FLOW-dashboard-tool-call`: Ein Fluss vom Host-Socket zu drei Werkzeugen mit drei Eingabeformen.

`GraphGenerateInputSchema` stand innerhalb der Funktion, die die Werkzeuge baut. Die vier Eingabeschemas waren nicht exportiert.

## Zug

1. `GraphExportInputSchema`, `GraphMetricsInputSchema`, `GraphSuggestInputSchema` und `GraphGenerateInputSchema` werden exportiert, das letzte auf Modulebene gehoben. Jeder Handler parst seine Eingabe selbst.
2. Modell: `FLOW-export-call`, `FLOW-metrics-call` und `FLOW-suggest-call` von `FUNC-agent-loop`, je mit eigenem SCHEMA. `FLOW-steering-trigger-agent`, `FLOW-export-request-import-code` und `FLOW-query-request-auto-export` werden auf ihr echtes Eingabeschema umgebunden.
3. `FLOW-dashboard-tool-call` entfällt. Dafür gibt es je Werkzeug einen Fluss vom Host-Socket: generate, metrics und readiness (FAQ `flow-ein-schema` Punkt 6).
4. Je SCHEMA ein erzeugter Vertragstest. Der Probelauf-Test ist neu gemessen.

## Nicht in diesem CR

`FLOW-dashboard-call` (Dashboard an Host-Socket) trägt die Zeile `ShimRequest` aus `@sigloch/graphcode-client`. Dort ist sie ein Interface ohne Schema, und der Host liest sie per Cast. Der Vertrag gehört ins Familienpaket. Er fährt mit dem Familien-Zug für `AuditEntry` und `Suggestion`.

## Folge für die Kennzahlen

Der Steuerwert geht von 12,50 auf 13,00.

## Abnahme

- R-32 nennt keines der vier neuen SCHEMA.
- Die Vertragstests sind grün. Die Gegenprobe ohne `.max(20)` an `k` macht 1 Fall rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1563, Tiefe 1, Wurzeln: `FLOW-query-request-agent`, `FLOW-dashboard-tool-call`._

Reichweite: 4 Elemente (FLOW 2, FUNC 2); Blackbox-Rand 57, nicht geoeffnet.

Dateien (realRef, 1):
- src/surface/host-shim.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
