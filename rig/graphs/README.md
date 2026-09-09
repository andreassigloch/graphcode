# Beispielgraphen — Korpus für Benchmark, Test und Demo

Echte, exportierte `*.graph.json` aus abgeschlossenen graphcode-Läufen. Zweck: Renderer-
und Tooling-Arbeit (Graphview, Viewer-Spikes, Layout-Benchmarks) gegen **echte** Graphen
statt gegen synthetische Fixtures messen.

**Warum hier und nicht in `docs/graph/`:** `docs/graph/*.graph.json` ist im jeweiligen
Consumer-Repo der *regierte* Export — einziger Schreiber ist `graph_export`, Hand-Writes
blockt der `deny-graph-write`-Hook (CR-GC-201), und der Pre-Commit-Guard prüft seine
Frische. Eine Fixture-Kopie dort wäre ein zweiter, driftender SSOT. Gleiche Begründung wie
bei `rig/dummy-slicer/model/dummy-slicer.graph.json`.

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

### Der Spike-Korpus (die unteren vier) — CR-GC-498

`scripts/spike-lexikographisch.mjs` las bis 2026-09-09 die **lebenden** `docs/graph/*.graph.json`
dieser vier Repos, drei davon über absolute Pfade in fremde Arbeitskopien. `CR-GC-493` gab ihm
einen Herkunftsstempel — die Drift war damit sichtbar, aber nicht weg. Seit `CR-GC-498` liest er
von hier und **prüft die Prüfsumme**: weicht eine Datei ab, bricht der Lauf ab.

| Datei | `sha256/12` |
|---|---|
| `bok.graph.json` | `03fdd3eae9ad` |
| `graph-view-edit.graph.json` | `a97af935f5b3` |
| `graphcode.graph.json` | `bc639cbc90c4` |
| `moneyflow.graph.json` | `e1d8a6cf3944` |

Die Erwartung steht als Konstante `KORPUS` im Spike selbst, nicht in einem zweiten Manifest —
neben dem Code, der sie liest. Wer bewusst neu verankert, ändert beides und schreibt die neue
Zahl in den CR, der sie verankert.

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
die anderen nicht haben — Größe, Typmix, Bindungsgrad. Läufe des Executor-Programms
gehören stattdessen nach `rig/greenfield-systemtest/results/`.
