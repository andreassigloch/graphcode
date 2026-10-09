# Messstand Stufe S1

> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten.
> Stempel des Laufs: graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty

| Test | Kriterium | Wert | Urteil | Datum | Stempel |
|---|---|---|---|---|---|
| T-V1 | 0 Befunde auf allen Ebenen | — `rig/moneyflow-struktur/driver.mjs` (graphanalyze) gibt nur Prosa aus (CR-GC-679B) | nicht erhoben | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-V2 | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | BW-02 15 bei 19 Whiteboxes | nicht bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-V4 | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | gedriftet, Bindung 108/109 (99 %), Grenzmenge FUNC 14/61, SCHEMA 11/55 | nicht bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-M3 | Verstöße je Element fallen monoton im Trend | — `spike-nachweis-history.mjs` hat kein Urteilsfeld, nur Kill-Zeilen (CR-GC-679B) | nicht erhoben | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-M4 | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | 12/12 grün | bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-E1 | Suchen, die der Graph beantwortet hätte, als Potenzial ausgewiesen (keine Schwelle) | KPI 1 Median 0.14 über die letzten 20 CRs (zuletzt CR-GC-768: 7 Graph-Lesungen, 13 Suchen) | ohne Schwelle | 2026-10-09 | commit 00852392 |
| T-E2 | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 (jüngste 10 CR-Commits) | 4/7 Jobs: CR-GC-732: 1/2 in W, \|W\|/\|G\| 0.029; CR-GC-729: 1/1 in W, \|W\|/\|G\| 0.026; CR-GC-728: 3/3 in W, \|W\|/\|G\| 0.015; CR-GC-727: 3/3 in W, \|W\|/\|G\| 0.012; CR-GC-726: 3/3 in W, \|W\|/\|G\| 0.011; CR-GC-724: 3/4 in W, \|W\|/\|G\| 0.063; CR-GC-723: 5/7 in W, \|W\|/\|G\| 0.036; Kalibrierung J1: 1/1 in W, \|W\|/\|G\| 0.846 | nicht bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-E8 | Runde lesen → Status → Vorschlag → Anwenden < 200 ms (feste Eingabe) | Median 2708.5 ms bei 2000 Knoten | nicht bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-O4 | Known-Answer-Set richtig gerankt, keine Regression einer Dimension mit Gewicht ≥ 1 | — `known-answer-set.mjs` gibt nur Markdown aus (CR-GC-679B) | nicht erhoben | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-O6 | ≥ 6/7 bekannte Paare gefunden | — ND- und Engpass-Spike geben nur Prosa aus (CR-GC-679B) | nicht erhoben | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-H2 | jede Regel steht in der Matrix, jede genannte ID existiert | Matrix = Katalog | bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
| T-O1 | Referenzkette reproduziert; ≥ 90 % der Ketten auswertbar | Referenzkette reproduziert; 49 von 79 Ketten bewertbar (62 %, 10 Graphen); nicht gerechnet: syncDepth, errorPathDepth | nicht bestanden | 2026-10-09 | graph 6a4c4d303a94 (1068/2482) · policy graphcode.config.jsonc · rules 44.0.0 · code 43896069+dirty |
