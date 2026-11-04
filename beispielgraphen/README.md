# Beispielgraphen — eingefrorene Graphen für Benchmark, Test und Demo

Exportierte `*.graph.json` aus abgeschlossenen graphcode-Läufen. Zweck: Tests und Tooling gegen **echte**
Graphen statt gegen synthetische Fixtures messen.

**Warum hier und nicht in `docs/graph/`:** `docs/graph/*.graph.json` ist im jeweiligen Consumer-Repo der
*regierte* Export — einziger Schreiber ist `graph_export`, Hand-Writes blockt der `deny-graph-write`-Hook
(CR-GC-201), und der Pre-Commit-Guard prüft seine Frische. Eine Fixture-Kopie dort wäre ein zweiter, driftender SSOT.

Die Dateien hier sind **eingefrorene Snapshots**. Sie werden nicht mitgezogen, wenn der Quellgraph weiterläuft —
ein Benchmark, dessen Eingabe sich ändert, misst nichts.

## Anonymisiert (CR-GC-891)

`sigllm-v98` und `moneyflow` stammen aus privaten Projekten. Hier liegen sie **anonymisiert**: jedes Wort in
Namen, Beschreibungen, uids, Pfaden und Testfällen ist durch ein Kunstwort gleicher Länge ersetzt, dasselbe Wort
überall durch dasselbe. Struktur, Typen, Kanten, Attributwerte und gleiche Texte bleiben; die Regelbefunde und
Antwortgrössen der Tests sind dieselben wie am Original. Original und Werkzeug (`scripts/anonymisiere-golden.mjs`)
liegen im privaten Repo graphanalyze; das Werkzeug erzeugt diese Dateien byte-gleich neu.

## Inhalt

| Datei | Quelle | Stand | Umfang |
|---|---|---|---|
| `graphcode.graph.json` | dieses Repo, Commit `27acdcd` | 2026-09-09, graphVersion 242 | 669 / 1823 — 164 CR, 137 REQ, 124 TEST, 115 FUNC |
| `moneyflow.graph.json` | privates Projekt, Commit `8209648`, anonymisiert | 2026-09-09, graphVersion 1 | 1229 / 966 — 425 TEST, 306 FUNC, 220 FLOW, 155 MOD |
| `sigllm-v98.graph.json` + `sigllm-v98.audit.jsonl` | handgeführter Lauf eines privaten Projekts 17./18.09.2026, Ende der Spezifikation (das „Golden") mit seinem Audit (der Hand-Trail, den `generate.statemachine` nachspielt), anonymisiert | 2026-09-18, graphVersion 98 | 255 / 506 |
| `gc-run-haiku45.graph.json` | Executor-Programm 2026-07/08 (CR-GC-678: einer von vier behaltenen Graphen) | 2026-08-01 | 86 / 154 |
| `gc-run-devstral-v14.graph.json` | Executor-Programm 2026-07/08 (dito) | 2026-08-01 | 85 / 148 |
| `todo-referenz/lokal/graph.json` | Referenzlauf der Rig-Aufgabe `todo`, Arm lokal (qwen3.8, OpenCode); eingefroren mit CR-GC-764, die lebende Referenz pflegt graphanalyze | 2026-10-08, graphVersion 4 | 39 / 57 |
| `todo-referenz/frontier/graph.json` | dito, Arm frontier (Opus, Claude Code) | 2026-10-08, graphVersion 12 | 61 / 109 |
| `dummy-slicer.graph.json` | fiktives Konsumenten-Repo `rig/dummy-slicer` (Spike 2026-06; Rig gelöscht mit CR-GC-740), Spezifikationsstand mit unrealisiertem `FN-slice` | 2026-06 | 13 / 14 |

Leser (CR-GC-737, Löschkonzept Regel 5 — ein Graph ohne Leser geht): `scripts/randbreiten.mjs` liest alle;
`sigllm-v98` lesen `generate.statemachine`, `generate.stufen`, `generate.task`, `steer-optimum`, `policy-herkunft`,
`read-tools.scope` und `working-set.spezlauf`; `moneyflow` trägt in `randbreiten.test` den Fall „grösster Graph,
0 Whiteboxen"; die beiden `gc-run-*` liest `tests/nd-similarity.test.ts`; `dummy-slicer` ist die Kalibrier-Fixture J1
der Whitebox-Messung (`scripts/whitebox-messung.mjs`, T-E2); die beiden `todo-referenz` lesen `generate.statemachine`
und `generate.stufen` (sie liegen im Unterverzeichnis, damit `randbreiten.mjs` sie nicht als gehaltenen Schnappschuss
zählt).

`bok`, `graph-view-edit` und `gc_test-graphview` liegen seit CR-GC-891 nur noch in graphanalyze: Sie hatten ausser
`randbreiten` keinen Leser.

## Prüfsummen

| Datei | `sha256/12` |
|---|---|
| `graphcode.graph.json` | `bc639cbc90c4` |
| `moneyflow.graph.json` | `527784436325` (anonymisiert; Original `e1d8a6cf3944`) |
| `sigllm-v98.graph.json` | `fe6d23e78387` (anonymisiert; Original `a2d01827f4a9`) |
| `gc-run-haiku45.graph.json` | `2ad907d1c308` |
| `gc-run-devstral-v14.graph.json` | `c72856633b89` |
| `dummy-slicer.graph.json` | `67f95860f44c` |

Die Tabelle ist die Referenz. `randbreiten.mjs` prüft die Prüfsummen heute **nicht** — ein Leser, der sich auf die
Zahlen verlässt, prüft sie selbst. Wer bewusst neu verankert, ändert die Tabelle und schreibt die neue Zahl in den CR,
der sie verankert.

**Was `graphcode` und `moneyflow` unterscheidet** (gemessen 2026-09-09):

| Graph | FUNC | `realRef`-Bindung | Kanten je Element | wofür er im Korpus ist |
|---|--:|--:|--:|---|
| `graphcode` | 115 | 81 % | 2,72 | das **dichteste** Selbstmodell, vollständige UC→REQ→FUNC→TEST-Kette |
| `moneyflow` | 306 | **0 %** | 0,79 | der **code-importierte**: die meisten Elemente, die wenigsten Kanten je Element, keine Bindung. Er hält den Fall im Korpus, in dem eine Kongruenz-Aussage **nicht** getroffen werden darf |

## Aufnahmekriterium

Ein Graph gehört hierher, wenn er (a) aus einem echten Lauf stammt, nicht generiert ist, (b) mit Datum und
`graphVersion` in der Tabelle steht, (c) eine Eigenschaft trägt, die die anderen nicht haben — Größe, Typmix,
Bindungsgrad — und (d) einen Leser hat. Stammt er aus einem privaten Projekt, liegt er hier nur anonymisiert.
Läufe des Rigs und der Referenzlauf je Aufgabe × Arm liegen im privaten Repo graphanalyze (`rig/runs/`,
`rig/aufgaben/<name>/referenz/<arm>/`).
