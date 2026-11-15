# Messstand

> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten. Die Definition je Größe steht in [`kennzahlen.md`](kennzahlen.md).
> Stempel des Laufs: graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty

| Nr | Zeile | Kriterium | Wert | Vorwert | Seit | Urteil | Datum | Stempel |
|---|---|---|---|---|---|---|---|---|
| 1, 2 | T-M3 | Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je Stufe ohne Plan fallen oder sind abgenommen (hier geurteilt: Fehler und Marken) | 24 Stände 2035e35..1a0ad56; Fehler höchstens 0; Marken SRR PDR CDR → SRR PDR CDR; Befunde ohne Plan 118 → 119 (Anforderung 9→9, Funktion 14→14, Datenfluss 0→1, Modul 32→32, Schema 2→2, Test 29→29, Bindung 32→32); Plan 416 → 424 | 24 Stände 2b5886c..9815ceb; Fehler höchstens 0; Marken SRR PDR CDR → SRR PDR CDR; Befunde ohne Plan 120 → 119 (Anforderung 9→9, Funktion 14→14, Datenfluss 0→1, Modul 32→32, Schema 2→2, Test 29→29, Bindung 32→32, immer 2→0); Plan 416 → 423 | 2026-11-15 | bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 3 | G3 | Steuerwert und Überschreitungen je Steuerregel (keine Schwelle) | Steuerwert 8.25 bei BW-02 FUNC-block-grounding; Überschreitungen: BW-02 14, CR-01 12, R-04 7, RD-04 8 (Stand 1a0ad56) | Steuerwert 8.25 bei BW-02 FUNC-block-grounding; Überschreitungen: BW-02 14, CR-01 12, R-04 7, RD-04 8 (Stand 9815ceb) | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 4 | G4 | Testergebnis je Anforderung (keine Schwelle) | 166 von 204 Anforderungen bestanden, 0 rot, 29 nie gelaufen (Stand 1a0ad56) | 166 von 204 Anforderungen bestanden, 0 rot, 29 nie gelaufen (Stand 9815ceb) | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 5 | G5 | Ketten bewertbar im eigenen Modell (keine Schwelle) | 33 von 33 Ketten bewertbar (Stand 1a0ad56) | 33 von 33 Ketten bewertbar (Stand 9815ceb) | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 6 | G6 | Folge ohne Schlupf, bereinigt (keine Schwelle) | Folge ohne Schlupf 0 CRs der Spur CODE (Schwelle 10); CODE-CRs mit Schlupf 43 von 105 | Folge ohne Schlupf 6 CRs der Spur CODE (Schwelle 10); CODE-CRs mit Schlupf 42 von 104 | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 7 | G7 | Bindung der Blackbox- und Schnittstellen-Tests (keine Schwelle) | Blackbox 86/102, Schnittstelle 36/47 (CR-GC-950) | Blackbox 86/102, Schnittstelle 36/47 (CR-GC-948) | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 8 | T-V4 | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | gedriftet, Bindung 110/111 (99 %), Grenzmenge FUNC 17/59, SCHEMA 12/53 | gedriftet, Bindung 110/111 (99 %), Grenzmenge FUNC 17/59, SCHEMA 12/53 | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 9 | G9 | Dauer Auswahl gegen Volllauf (keine Schwelle) | Auswahl 197 s gegen Volllauf 345 s, Rechenzeit (CR-GC-950) | Auswahl 196 s gegen Volllauf 345 s, Rechenzeit (CR-GC-949) | 2026-11-15 | ohne Schwelle | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 10 | T-E8 | Runde lesen → Status → Vorschlag → Anwenden < 200 ms (feste Eingabe) | Median 2621.3 ms bei 2000 Knoten | Median 2565.8 ms bei 2000 Knoten | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| 12 | T-E1 | `graph_impact` bei CRs mit Löschung aufgerufen (keine Schwelle) | 6 von 20 CRs mit Löschung riefen graph_impact (jüngste 20; zuletzt CR-GC-946: nein) | 6 von 20 CRs mit Löschung riefen graph_impact (jüngste 20; zuletzt CR-GC-946: nein) | 2026-11-15 | ohne Schwelle | 2026-11-15 | commit 1a0ad56f |
| — | T-V2 | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | BW-02 14 bei 17 Whiteboxes | BW-02 14 bei 17 Whiteboxes | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| — | T-M4 | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | 12/12 grün | 12/12 grün | 2026-11-15 | bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| — | T-E2 | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 (jüngste 10 CR-Commits) | 0/10 Jobs: CR-GC-950: 2/161 in W, \|W\|/\|G\| 0.009; CR-GC-948: 0/161 in W, \|W\|/\|G\| 0.001; CR-GC-949: 6/161 in W, \|W\|/\|G\| 0.042; CR-GC-947: 1/160 in W, \|W\|/\|G\| 0.016; CR-GC-945: 0/162 in W, \|W\|/\|G\| 0.001; CR-GC-946: 9/170 in W, \|W\|/\|G\| 0.022; CR-GC-944: 6/158 in W, \|W\|/\|G\| 0.024; CR-GC-942: 0/158 in W, \|W\|/\|G\| 0.001; CR-GC-941: 1/158 in W, \|W\|/\|G\| 0.008; CR-GC-941: 1/160 in W, \|W\|/\|G\| 0.008; Kalibrierung J1: 1/1 in W, \|W\|/\|G\| 0.846 | 1/10 Jobs: CR-GC-949: 6/161 in W, \|W\|/\|G\| 0.042; CR-GC-947: 1/160 in W, \|W\|/\|G\| 0.016; CR-GC-945: 0/162 in W, \|W\|/\|G\| 0.001; CR-GC-946: 9/170 in W, \|W\|/\|G\| 0.022; CR-GC-944: 6/158 in W, \|W\|/\|G\| 0.024; CR-GC-942: 0/158 in W, \|W\|/\|G\| 0.001; CR-GC-941: 1/158 in W, \|W\|/\|G\| 0.008; CR-GC-941: 1/160 in W, \|W\|/\|G\| 0.008; CR-GC-940: 6/158 in W, \|W\|/\|G\| 0.025; CR-GC-940: 3/3 in W, \|W\|/\|G\| 0.025; Kalibrierung J1: 1/1 in W, \|W\|/\|G\| 0.846 | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| — | T-H2 | jede Regel steht in der Matrix, jede genannte ID existiert | fehlt BQ-03, FC-06, R-35, RC-11, RC-12, RC-13, UC-07; unbekannt BQ-06, CR-R02, FC-02 | fehlt BQ-03, FC-06, R-35, RC-11, RC-12, RC-13, UC-07; unbekannt BQ-06, CR-R02, FC-02 | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |
| — | T-O1 | Referenzkette reproduziert; ≥ 90 % der Ketten auswertbar | Referenzkette reproduziert; 75 von 94 Ketten bewertbar (80 %, 10 Graphen); nicht gerechnet: syncDepth, errorPathDepth, answerPath | Referenzkette reproduziert; 75 von 94 Ketten bewertbar (80 %, 10 Graphen); nicht gerechnet: syncDepth, errorPathDepth, answerPath | 2026-11-15 | nicht bestanden | 2026-11-15 | graph 561134460678 (1442/3845) · policy graphcode.config.jsonc · rules 50.1.0 · code 1a0ad56f+dirty |

## Ein Stand je Woche

Der letzte committete Stand von `docs/graph` je Kalenderwoche. „Befunde ohne Plan“ summiert alle Stufen außer Plan.

| Woche | Datum | Stand | Erreichte Marken | Befunde ohne Plan | Befunde Plan |
|---|---|---|---|---|---|
| 2026-W30 | 2026-07-26 | 1688511 | keine | 364 | 38 |
| 2026-W31 | 2026-07-29 | b37e822 | keine | 364 | 44 |
| 2026-W32 | 2026-08-08 | a1c73df | keine | 343 | 94 |
| 2026-W33 | 2026-08-16 | 3ac435a | keine | 434 | 97 |
| 2026-W34 | 2026-08-23 | 0f015a0 | keine | 424 | 1 |
| 2026-W35 | 2026-08-28 | f5e4c61 | keine | 613 | 0 |
| 2026-W36 | 2026-09-05 | 3c6b3b0 | keine | 519 | 0 |
| 2026-W37 | 2026-09-12 | 798a990 | keine | 286 | 0 |
| 2026-W38 | 2026-09-20 | 6698d3e | keine | 292 | 42 |
| 2026-W39 | 2026-09-27 | f4479d9 | SRR | 228 | 166 |
| 2026-W40 | 2026-10-04 | e6b680e | SRR | 206 | 202 |
| 2026-W41 | 2026-10-11 | e2baf2e | SRR | 147 | 262 |
| 2026-W42 | 2026-10-16 | 3da5e29 | SRR | 135 | 298 |
| 2026-W43 | 2026-10-25 | e25c307 | SRR PDR CDR | 129 | 323 |
| 2026-W44 | 2026-10-29 | bc2fc9e | SRR PDR CDR | 119 | 356 |
| 2026-W45 | 2026-11-04 | 0031bba | SRR PDR CDR | 119 | 363 |
| 2026-W46 | 2026-11-15 | 1a0ad56 | SRR PDR CDR | 119 | 424 |
