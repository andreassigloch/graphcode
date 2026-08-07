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
