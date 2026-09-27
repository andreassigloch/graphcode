# Messstand Stufe S1

> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten.
> Stempel des Laufs: graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260

| Test | Kriterium | Wert | Urteil | Datum | Stempel |
|---|---|---|---|---|---|
| T-V1 | 0 Befunde auf allen Ebenen | — `rig/moneyflow-struktur/driver.mjs` gibt nur Prosa aus (CR-GC-679B) | nicht erhoben | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-V2 | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | BW-02 15 bei 19 Whiteboxes | nicht bestanden | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-V4 | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | gedriftet, Bindung 108/109 (99 %), Grenzmenge FUNC 15/61, SCHEMA 12/56 | nicht bestanden | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-M3 | Verstöße je Element fallen monoton im Trend | — `spike-nachweis-history.mjs` hat kein Urteilsfeld, nur Kill-Zeilen (CR-GC-679B) | nicht erhoben | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-M4 | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | 12/12 grün | bestanden | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-E1 | Suchen, die der Graph beantwortet hätte, als Potenzial ausgewiesen (keine Schwelle) | KPI 1 Median 0.23 über die letzten 20 CRs (zuletzt CR-GC-699: 0 Graph-Lesungen, 0 Suchen) | ohne Schwelle | 2026-09-27 | commit 7803392 |
| T-E2 | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 | — `run-phase1.mjs` schreibt ins Repo (`rig/minimal-whitebox/results/`) (CR-GC-679B) | nicht erhoben | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-E8 | Runde lesen → Status → Vorschlag → Anwenden < 200 ms (feste Eingabe) | Median 2660.9 ms bei 2000 Knoten | nicht bestanden | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-O4 | Known-Answer-Set richtig gerankt, keine Regression einer Dimension mit Gewicht ≥ 1 | — `known-answer-set.mjs` gibt nur Markdown aus (CR-GC-679B) | nicht erhoben | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-O6 | ≥ 6/7 bekannte Paare gefunden | — ND- und Engpass-Spike geben nur Prosa aus (CR-GC-679B) | nicht erhoben | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
| T-H2 | jede Regel steht in der Matrix, jede genannte ID existiert | Matrix = Katalog | bestanden | 2026-09-27 | graph 6dbefd4570f4 (974/2309) · policy graphcode.config.jsonc · rules 34.0.0 · code b880260 |
