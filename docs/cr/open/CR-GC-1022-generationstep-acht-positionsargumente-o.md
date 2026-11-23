# CR-GC-1022: generationStep: acht Positionsargumente ohne Vertrag, ein Aufrufer gibt sie verschoben

**Typ:** aus Item ITEM-2026-1630 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1630.json (Lane: code)

---

## Befund

`generationStep` nimmt acht Positionsargumente: Graph, Metrikpolitik, Intention, Schwelle, Zurückgestelltes, Zielprofil, Task und Steuer-Optimum. Einen Vertrag dafür gibt es nicht. `FLOW-generation-request` hängt deshalb am Sammelknoten `SCHEMA-query-params`.

Die Folge ist am Code belegt. Ein Auswertungsskript in einem privaten Nachbar-Repo ruft `generationStep` aus `dist` auf und gibt die Argumente ab Position 6 verschoben. Als Zielprofil kommt ein Text an, als Task `null`, als Steuer-Optimum der Text `'kern'`. Nichts davon fällt beim Aufruf auf.

Beifang: Eine Testvorlage in `tests/generate.test.ts` trug noch das Feld `conflicts`, das seit CR-GC-861 nicht mehr zum Zielprofil gehört.

## Zug

1. `GenerationRequestSchema` in `src/loop/generate.ts`. Es setzt sich aus vorhandenen Schemas zusammen: `GraphSchema` (graph-api-core), `MetricPolicySchema` und `RULE_TASKS` (contracts), `TargetProfileSchema` und das neue `SteerOptimumSchema`. Das bisherige interface `SteerOptimum` wird aus dem Schema abgeleitet.
2. `generationStep` nimmt ein Objekt und parst es. Gerechnet wird auf dem Original des Graphen: Die Kopie des Schemas verlöre Felder, die der Vertrag nicht nennt. Ein Parse des ganzen eigenen Modells (1.823 Knoten, 4.598 Kanten) kostet 0,72 ms.
3. Alle 103 Aufrufe in `src/` und `tests/` werden per Syntaxbaum umgestellt, nicht per Textersetzung.
4. Neues `SCHEMA-generation-request`. `FLOW-generation-request` hängt daran. `SCHEMA-query-params` hat danach keinen Fluss mehr und wird gelöscht.
5. Vertragstest aus `graphcode vertragstest`, TEST-Knoten mit `verify`.
6. Den Aufruf im Nachbar-Repo stellt ein eigener Commit dort um.

## Dateigrenze

Der CR berührt 23 Dateien statt höchstens 10: 4 in `src/`, 17 Testdateien, den neuen Vertragstest und die CR-Datei. Ein Schnitt ließe die Aufrufer rot stehen oder bräuchte die alte Signatur als zweiten Weg daneben. Er bleibt deshalb ganz (FAQ `cr-dateigrenze-ausnahme`, Punkt 2). Der Autor hat den Umbau am 2026-11-23 freigegeben, in Kenntnis der 17 Testdateien. Die Testdateien ändern nur die Form des Aufrufs. Das Umbauskript arbeitet auf dem Syntaxbaum.

## Abnahme

- `SCHEMA-query-params` existiert nicht mehr.
- R-26, R-32 und RC-04 nennen `SCHEMA-generation-request` nicht.
- Der Vertragstest wird rot, wenn das Schema geschwächt wird.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1592, Tiefe 1, Wurzeln: `FLOW-generation-request`, `SCHEMA-query-params`._

Reichweite: 2 Elemente (FLOW 1, FUNC 1); Blackbox-Rand 6, nicht geoeffnet.

Dateien (realRef, 1):
- src/loop/suggest.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
