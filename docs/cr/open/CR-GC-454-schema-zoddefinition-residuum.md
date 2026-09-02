# CR-GC-454 — SCHEMA: kopierte Zod-Körper raus, Bindung rein

**Status:** open
**Angelegt:** 2026-09-02

## Root Cause

Neun SCHEMA-Knoten tragen ein Attribut `zodDefinition` — eine **von Hand kopierte Zod-Definition
im Graphen**. Die Governance hat das bereits verboten (BOK-CR-026,
`packages/contracts/src/se/schema-quality-rules.ts`):

> `realRef` is the single SCHEMA binding truth […]; a spec-only SCHEMA is `concept:true`,
> **it does NOT carry a Zod body copy in the graph** (same rule as TEST: bindings point at code,
> they never mirror it).

CR-GC-271 (done 2026-07-28) hat die **Leseseite** umgestellt — Exporter und ICD lesen seither
`realRef` und **nicht** mehr `zodDefinition` als Fallback (kein Parallelpfad). CR-SM-220 hat danach
SC-01/SC-03 entfernt. **Die Daten blieben stehen** — niemand hat die Kopien aus dem Graphen genommen. Der ICD-Exporter ignoriert sie seit BOK-CR-026 ([incose.ts:76](src/projections/incose.ts#L76)).
Ein Agent, der den Graphen liest, ignoriert sie nicht.

## Der Schaden ist messbar — an mir selbst

Die Kopien sind gegenüber dem Code auseinandergelaufen. `SCHEMA-mutate-command` dokumentiert im
Graphen `{op: 'add'|'update'|'delete', target, element, consumerType}`. Der Code
(`packages/contracts/src/harness/index.ts#MutateCommandSchema`) ist eine
`discriminatedUnion('op')` über sieben Operationen (`add-node`, `update-node`, `delete-node`,
`add-edge`, `delete-edge`, `update-edge`, `merge-nodes`).

**In dieser Session habe ich genau danach gehandelt und einen `tier: "block"` mit drei SCHEMA-01-
Verstößen kassiert**, weil ich die Modellform statt der Codeform geschrieben habe. Das ist der
Preis des Residuums, nicht hypothetisch.

Weitere Abweichungen:

| SCHEMA | Modell-Kopie | Code | Fehler |
|---|---|---|---|
| MutateResult | `applied` | `appliedCommands` + `mutations` | Feldname falsch, 1 Feld fehlt |
| MutateResult | tier `['auto',…]` | `['auto-apply',…]` | **Enum-Wert falsch** |
| MutateResult | — | `trajectoryId, graphVersion, stale, staleDelta` | 4 Felder fehlen |
| MutateResult | violation `.msg` | `.message` | Feldname falsch |
| UpdateEvent | `{type,domains,version}` | `{type,domains,ts,version?}` | `ts` fehlt, `version` fälschlich Pflicht |
| Format-E | `{nodes,edges,operations,baseSnapshot}` | `FormatEDiff {operations,errors}` | Form komplett falsch |
| Trajectory | `{step,action,outcome,ts}` | `{ts,consumerId,consumerType,operation,opCounts,applied,outcome,violations}` | 5 Felder fehlen |

## Impact

Bricht: jede Autoring-Runde, die ihre Kommandoform aus dem Graphen zieht — Agenten, `se:*`-Skills,
`graph_generate`. Bricht **nicht**: Laufzeit, Gate, Regeln — das echte Zod validiert korrekt, es
weist den Aufrufer nur zurück, statt ihn richtig anzuleiten.

Kein Code-Refactoring: die Verträge im Code bleiben, wo und wie sie sind. Es fällt nur die Kopie.

## Umfang — 9 Knoten

**Bindung setzen** (`realRef` auf das echte Symbol, `external` bleibt — der Vertrag lebt in einem
anderen Paket, Präzedenz `SCHEMA-metric-policy`/`SCHEMA-metric-vector`):

| SCHEMA | realRef |
|---|---|
| `SCHEMA-ontology-graph` | `packages/contracts/src/se/ontology.ts#OntologyGraph` |
| `SCHEMA-mutate-command` | `packages/contracts/src/harness/index.ts#MutateCommandSchema` |
| `SCHEMA-mutate-result` | `packages/contracts/src/harness/index.ts#MutateResultSchema` |
| `SCHEMA-update-event` | `packages/contracts/src/harness/index.ts#LiveUpdateEventSchema` |
| `SCHEMA-trajectory` | `packages/learning-core/src/interfaces/trajectory.ts#TrajectorySchema` |
| `SCHEMA-format-e` | `packages/contracts/src/se/format-e-parser.ts#FormatEDiff` |

**Kopie löschen** (`zodDefinition` als null-Grabstein) auf allen neun — zusätzlich zu den sechs
oben auch `SCHEMA-cli-command`, `SCHEMA-markdown-view` (beide haben bereits einen `realRef`, die
Kopie ist eine zweite Wahrheit) und `SCHEMA-query-params` (`concept:true`, aber BOK-CR-026 gilt für
spec-only ausdrücklich genauso).

**Prosa-Drift mit:** `SCHEMA-round-injection` nennt `src/executor/executor-prompt.ts`; die Datei
liegt seit dem 5er-Modulschnitt unter [src/loop/executor-prompt.ts](src/loop/executor-prompt.ts).
`SCHEMA-query-params` sagt nur „Query-/Request-Parameter." und bleibt damit als einziges
`concept:true` ohne Begründung — die anderen vier tragen eine.

## Acceptance

- [ ] kein `zodDefinition` mit Inhalt mehr im SSOT (9 null-Grabsteine bleiben — Attribute sind
      mergebar, nicht löschbar; das ist die Gate-Semantik, kein Rest)
- [ ] die sechs Bindungen lösen gegen den echten Quellbaum auf (RC-03/RC-04 in `rules_evaluate`)
- [ ] `graph_export` legt keine Stub-Datei an (`stubs: []`)
- [ ] Suite ohne neue Rote gegenüber der HEAD-Baseline (4c91b69: 10 Dateien / 16 Tests rot,
      darunter die bekannten Link-Modus-Roten `lockfile-sync` und `distribution`)
