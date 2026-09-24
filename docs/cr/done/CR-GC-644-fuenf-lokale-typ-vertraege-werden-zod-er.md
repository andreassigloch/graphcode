# CR-GC-644: Fuenf lokale Typ-Vertraege werden Zod, Erzeuger parsen ihre Ausgabe

**Status:** ✅ Done (2026-09-24) — mit einer benannten Ausnahme (SteeringSnapshot, s. u.)
**Typ:** aus Item ITEM-2026-535 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-535.json (Lane: code)

---

RC-08 = 5 in graphcode: AuditStats, GraphDelta, OntologyJson, RejectedTrace, SteeringSnapshot sind an TS-Typen gebunden. Jeder wird ein Zod-Schema (Typ per z.infer), SCHEMA bindet das Schema, und der Erzeuger in der Definitionsdatei parst seine Ausgabe - wer Daten erzeugt, braucht ein sicheres Schema, auch wenn der Leser noch unbekannt ist. Bausteine der Familie: GraphNodeSchema/GraphEdgeSchema (graph-api-core), OntologyGraph, RuleViolation, ReadinessReport (contracts), RuleViolationSchema (harness), PhaseGateReadiness (lokal). Ratsche RC-08 <= 5 wird RC-08 = 0.

---

## Umsetzung (2026-09-24)

Die fuenf Vertraege sind Zod-Schemas, die Typen werden per `z.infer` abgeleitet, und `SCHEMA-*` bindet
das Schema:

| Vertrag | Schema | geprueft wo | Bausteine |
|---|---|---|---|
| OntologyJson | `OntologyJsonSchema` | `importOntologyGraph`, `heldBackTraces`: wo die SSOT-Datei das Programm betritt (vorher `as`) | lose Elemente/Kanten |
| RejectedTrace | `RejectedTraceSchema` | an beiden Erzeugungsstellen | — |
| GraphDelta | `GraphDeltaSchema` | `GraphStore.commit`, an der Persistenzgrenze | `GraphNodeSchema`/`GraphEdgeSchema` (graph-api-core) |
| AuditStats | `AuditStatsSchema` (+ Rule/Consumer/ModelStat) | `aggregateAuditEntries` parst seine Ausgabe | — |
| SteeringSnapshot | `SteeringSnapshotSchema` | **noch nicht** (Ausnahme) | `OntologyGraph`, `RuleViolation`, `ReadinessReport` (contracts), `PhaseGateReadiness` |

Ratsche `conformance.test.ts`: aus RC-08 ≤ 5 wird **RC-08 = 0**, zuerst rot. RC-09 bleibt 0.

## Benannte Ausnahme: SteeringSnapshot pruefte echte Daten und fand zwei Vertragsbrueche

Mit eingeschalteter Laufzeitpruefung wurden 10 Tests rot, alle ueber `og` (den Ontologie-Graphen,
den `toOntologyGraph` erzeugt):

1. **`status` ausserhalb des Element-Vertrags (41x).** Das graphcode-SSOT traegt `CR-GC-248` und
   `CR-GC-261` mit `dropped` und `REQ-store-owner-lifecycle` mit `approved`. contracts widerspricht
   sich dabei selbst: `OntologyElement.status` kennt nur draft/reviewed/open/done, `CLOSED_STATUS`
   (cr-quality-rules.ts:50) rechnet mit done/dropped/rejected. **Familienentscheidung** → ITEM-2026-536.
2. **`kinds` als String statt Liste (294x, Rig-Korpora opus5-5..9).** Das Gate prueft den Typ
   nicht: Ein `graph_mutate` mit `[kinds:functional]` scheitert im Probelauf nur an R-01.
   `toOntologyGraph` behauptet den Typ per `as`, und Regeln mit `e.kinds?.includes(x)` machen
   daraus still eine Teilstring-Suche. → ITEM-2026-537 (Pruefung am Schreibweg).

Die Pruefung wurde **nicht** aufgeweicht. Sie ist noch nicht eingeschaltet, und der Code sagt das an
der Stelle. RC-04 meldet `SCHEMA-steering-snapshot` als „nicht an der Schnittstelle geparst“
(RC-04 14 → 15). So bleibt die offene Stelle sichtbar, bis die beiden Items erledigt sind.

VOLL 1538/1540; rot ist nur das Paar aus dem Link-Modus.

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
