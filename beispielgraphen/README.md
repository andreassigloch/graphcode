# Beispielgraphen — eingefrorene Graphen für Benchmark, Test und Demo

Echte, exportierte `*.graph.json` aus abgeschlossenen graphcode-Läufen. Zweck: Renderer-
und Tooling-Arbeit (Graphview, Viewer-Spikes, Layout-Benchmarks) gegen **echte** Graphen
statt gegen synthetische Fixtures messen.

**Warum hier und nicht in `docs/graph/`:** `docs/graph/*.graph.json` ist im jeweiligen
Consumer-Repo der *regierte* Export — einziger Schreiber ist `graph_export`, Hand-Writes
blockt der `deny-graph-write`-Hook (CR-GC-201), und der Pre-Commit-Guard prüft seine
Frische. Eine Fixture-Kopie dort wäre ein zweiter, driftender SSOT.

Die Dateien hier sind **eingefrorene Snapshots**. Sie werden nicht mitgezogen, wenn der
Quellgraph weiterläuft — ein Benchmark, dessen Eingabe sich ändert, misst nichts.

## Inhalt

| Datei | Quelle | Stand | Umfang |
|---|---|---|---|
| `gc_test-graphview.graph.json` | `~/Developer/dev/gc_test-graphview`, `docs/graph/` | 2026-08-07, graphVersion 31 | 253 Elemente / 448 Traces — 62 REQ, 46 TEST, 36 FLOW, 33 CR, 24 FUNC, 21 SCHEMA, 7 × (FCHAIN/MOD/MS/UC), 2 ACTOR, 1 SYS |
| `bok.graph.json` | `~/Developer/dev/bok`, Commit `4d36f92` | 2026-09-09, graphVersion 25 | 104 / 177 — 26 REQ, 26 TEST, 15 FLOW, 12 FUNC |
| `graph-view-edit.graph.json` | `~/Developer/dev/graph-view-edit`, Commit `b833e8d` | 2026-09-09, graphVersion 1192 | 276 / 671 — 131 CR, 74 REQ, 18 TEST, 13 FUNC |
| `graphcode.graph.json` | dieses Repo, Commit `27acdcd` | 2026-09-09, graphVersion 242 | 669 / 1823 — 164 CR, 137 REQ, 124 TEST, 115 FUNC |
| `moneyflow.graph.json` | `~/Developer/dev/moneyflow`, Commit `8209648` | 2026-09-09, graphVersion 1 | 1229 / 966 — 425 TEST, 306 FUNC, 220 FLOW, 155 MOD |
| `sigllm-v98.graph.json` + `sigllm-v98.audit.jsonl` | handgeführter Lauf sigllm 17./18.09.2026, Ende der Spezifikation (das „Golden") mit seinem Audit (der Hand-Trail, den `generate.statemachine` nachspielt) | 2026-09-18, graphVersion 98 | 255 / 506 |
| `gc-run-haiku45.graph.json` | Executor-Programm 2026-07/08 (CR-GC-678: einer von vier behaltenen Graphen) | 2026-08-01 | 86 / 154 |
| `gc-run-devstral-v14.graph.json` | Executor-Programm 2026-07/08 (dito) | 2026-08-01 | 85 / 148 |
| `todo-referenz/lokal/graph.json` | Referenzlauf der Rig-Aufgabe `todo`, Arm lokal (qwen3.8, OpenCode); eingefroren mit CR-GC-764, die lebende Referenz pflegt graphanalyze | 2026-10-08, graphVersion 4 | 39 / 57 |
| `todo-referenz/frontier/graph.json` | dito, Arm frontier (Opus, Claude Code) | 2026-10-08, graphVersion 12 | 61 / 109 |
| `dummy-slicer.graph.json` | fiktives Konsumenten-Repo `rig/dummy-slicer` (Spike 2026-06; Rig gelöscht mit CR-GC-740), Spezifikationsstand mit unrealisiertem `FN-slice` | 2026-06 | 13 / 14 |

Leser (CR-GC-737, Löschkonzept Regel 5 — ein Graph ohne Leser geht): `scripts/randbreiten.mjs` liest alle;
`sigllm-v98` lesen `generate.statemachine`, `generate.task`, `steer-optimum`, `policy-herkunft`,
`read-tools.scope`, `working-set.spezlauf` und die Aufgabe `sigllm-prosa` in graphanalyze; die beiden
`gc-run-*` liest `tests/nd-similarity.test.ts`; `dummy-slicer` ist die Kalibrier-Fixture J1 der Whitebox-Messung
(`scripts/whitebox-messung.mjs`, T-E2); die beiden `todo-referenz` lesen `generate.statemachine` und `generate.stufen`
(sie liegen im Unterverzeichnis, damit `randbreiten.mjs` sie nicht als gehaltenen Schnappschuss zählt).

### Der Spike-Korpus (die unteren vier) — CR-GC-498

Eingefroren seit `CR-GC-498` (2026-09-09); Leser heute: `scripts/randbreiten.mjs`. Der
ursprüngliche Leser `spike-lexikographisch.mjs` ist mit seinem No-Go-Befund gelöscht (CR-GC-676,
Befund in der graphcode-Leitlinie T-O4).

| Datei | `sha256/12` |
|---|---|
| `bok.graph.json` | `03fdd3eae9ad` |
| `graph-view-edit.graph.json` | `a97af935f5b3` |
| `graphcode.graph.json` | `bc639cbc90c4` |
| `moneyflow.graph.json` | `e1d8a6cf3944` |
| `sigllm-v98.graph.json` | `a2d01827f4a9` |
| `gc-run-haiku45.graph.json` | `2ad907d1c308` |
| `gc-run-devstral-v14.graph.json` | `c72856633b89` |
| `dummy-slicer.graph.json` | `67f95860f44c` |

Die Tabelle ist die Referenz. `randbreiten.mjs` prüft die Prüfsummen heute **nicht** — ein Leser,
der sich auf die Zahlen verlässt, prüft sie selbst. Wer bewusst neu verankert, ändert die Tabelle
und schreibt die neue Zahl in den CR, der sie verankert.

**Was die vier unterscheidet** (das Aufnahmekriterium (c), gemessen 2026-09-09):

| Graph | FUNC | `realRef`-Bindung | Kanten je Element | wofür er im Korpus ist |
|---|--:|--:|--:|---|
| `bok` | 12 | 33 % | 1,70 | der **kleine, flache** — alle fünf Stufen bei 0; Degenerate-Fall aus CR-SM-291 Satz H |
| `graph-view-edit` | 13 | 92 % | 2,43 | **höchste Bindung**, CR-lastig (131 CR) — viel Historie, wenig Code je FUNC |
| `graphcode` | 115 | 81 % | 2,72 | das **dichteste** Selbstmodell, vollständige UC→REQ→FUNC→TEST-Kette |
| `moneyflow` | 306 | **0 %** | 0,79 | der **code-importierte**: die meisten Elemente, die wenigsten Kanten je Element, keine Bindung. Ein Modell mit 0 % kann nie kongruent sein — es kann nur schön sein. Er hält den Fall im Korpus, in dem eine Kongruenz-Aussage **nicht** getroffen werden darf |

Die Spreizung 0 % … 92 % ist der Zweck: eine Rangfrage, die nur auf gut gebundenen Graphen
funktioniert, fällt hier auf.

### `gc_test-graphview`

Das Systemmodell des graphcode-Feldtests „Graphview" (Bericht:
[`docs/GC_test-graphview-results.md`](../../docs/GC_test-graphview-results.md)) — reine
Modellierung, null Zeilen Produktivcode, null Fehler-Violations, Gates SRR/PDR/CDR
regelrein. Damit deckt er alle Elementtypen ab und trägt eine vollständige
Ableitungskette UC → REQ → FUNC → TEST, was ihn als Renderer-Eingabe brauchbar macht.

Zwei Einschränkungen für Benchmarks: er ist mit 253 Elementen **klein** — die
Responsiveness-Messung aus CR-GVW-007 lief bei 500/2000/5000 Knoten und brauchte dafür
synthetische Graphen; und er ist code-los, also ohne aufgelöste `realRef`/`testRef`.

## Aufnahmekriterium

Ein Graph gehört hierher, wenn er (a) aus einem echten Lauf stammt, nicht generiert ist,
(b) mit Datum und `graphVersion` in der Tabelle steht und (c) eine Eigenschaft trägt, die
die anderen nicht haben — Größe, Typmix, Bindungsgrad. Läufe des Rigs und der Referenzlauf je Aufgabe × Arm
liegen im privaten Repo graphanalyze (`rig/runs/`, `rig/aufgaben/<name>/referenz/<arm>/`).
