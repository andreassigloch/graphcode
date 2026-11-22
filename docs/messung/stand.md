# Messstand

> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten. Die Definition je Größe steht in [`kennzahlen.md`](kennzahlen.md).
> Stempel des Laufs: graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty

| Nr | Zeile | Kriterium | Wert | Vorwert | Seit | Urteil | Datum | Stempel |
|---|---|---|---|---|---|---|---|---|
| 1, 2 | T-M3 | Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je Stufe ohne Plan fallen oder sind abgenommen (hier geurteilt: Fehler und Marken) | 24 Stände 050be96..fca8044; Fehler höchstens 0; Marken SRR PDR → SRR PDR; Befunde ohne Plan 104 → 102 (Anforderung 9→9, Funktion 14→14, Modul 34→35, Schema 9→9, Test 17→14, Bindung 21→21); Plan 434 → 453 | 24 Stände e90aae1..a55747a; Fehler höchstens 0; Marken SRR PDR → SRR PDR; Befunde ohne Plan 120 → 121 (Anforderung 9→9, Funktion 15→15, Modul 33→34, Schema 13→13, Test 29→29, Bindung 21→21); Plan 429 → 437 | 2026-11-22 | bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 3 | G3 | Steuerwert und Überschreitungen je Steuerregel (keine Schwelle) | Steuerwert 9.75 bei BW-02 FUNC-block-grounding; Überschreitungen: BW-02 14, CR-01 13, MT-02 0, R-04 7, RD-04 10 (Stand fca8044) | Steuerwert 9.75 bei BW-02 FUNC-block-grounding; Überschreitungen: BW-02 14, CR-01 13, MT-02 0, R-04 7, RD-04 9 (Stand a55747a) | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 4 | G4 | Testergebnis je Anforderung (keine Schwelle) | 266 von 308 Anforderungen bestanden, 4 rot, 29 nie gelaufen (Stand fca8044) | 260 von 302 Anforderungen bestanden, 4 rot, 29 nie gelaufen (Stand a55747a) | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 5 | G5 | Ketten bewertbar im eigenen Modell (keine Schwelle) | 34 von 34 Ketten bewertbar (Stand fca8044) | 34 von 34 Ketten bewertbar (Stand a55747a) | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 6 | G6 | Folge ohne Schlupf, bereinigt (keine Schwelle) | Folge ohne Schlupf 29 CRs der Spur CODE (Schwelle 10); CODE-CRs mit Schlupf 47 von 150 | Folge ohne Schlupf 2 CRs der Spur CODE (Schwelle 10); CODE-CRs mit Schlupf 47 von 123 | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 7 | G7 | Bindung der Blackbox- und Schnittstellen-Tests (keine Schwelle) | Blackbox 84/100, Schnittstelle 69/69 (CR-GC-1009) | Blackbox 84/100, Schnittstelle 47/58 (CR-GC-966) | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 8 | T-V4 | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | gedriftet, Bindung 120/121 (99 %), Grenzmenge FUNC 17/61, SCHEMA 17/58 | gedriftet, Bindung 118/119 (99 %), Grenzmenge FUNC 17/62, SCHEMA 14/57 | 2026-11-22 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 9 | G9 | Dauer Auswahl gegen Volllauf (keine Schwelle) | Auswahl 303 s gegen Volllauf 468 s, Rechenzeit (CR-GC-1009) | Auswahl 223 s gegen Volllauf 381 s, Rechenzeit (CR-GC-966) | 2026-11-22 | ohne Schwelle | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 10 | T-E8 | Runde lesen → Status → Vorschlag → Anwenden < 200 ms (feste Eingabe) | Median 2795.9 ms bei 2000 Knoten | Median 2682.7 ms bei 2000 Knoten | 2026-11-22 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| 12 | T-E1 | `graph_impact` bei CRs mit Löschung aufgerufen (keine Schwelle) | 5 von 20 CRs mit Löschung riefen graph_impact (jüngste 20; zuletzt CR-GC-1008: nein) | 6 von 20 CRs mit Löschung riefen graph_impact (jüngste 20; zuletzt CR-GC-946: nein) | 2026-11-22 | ohne Schwelle | 2026-11-22 | commit fca80445 |
| — | T-V2 | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | BW-02 14 bei 17 Whiteboxes | BW-02 14 bei 17 Whiteboxes | 2026-11-15 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| — | T-M4 | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | 12/12 grün | 12/12 grün | 2026-11-15 | bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| — | T-E2 | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 (jüngste 10 CR-Commits) | 0/10 Jobs: CR-GC-1009: 53/251 in W, \|W\|/\|G\| 0.031; CR-GC-1007: 9/220 in W, \|W\|/\|G\| 0.005; CR-GC-1006: 6/216 in W, \|W\|/\|G\| 0.026; CR-GC-1005: 2/215 in W, \|W\|/\|G\| 0.001; CR-GC-1004: 3/215 in W, \|W\|/\|G\| 0.01; CR-GC-1003: 2/214 in W, \|W\|/\|G\| 0.015; CR-GC-1002: 7/218 in W, \|W\|/\|G\| 0.018; CR-GC-1001: 8/221 in W, \|W\|/\|G\| 0.009; CR-GC-1000: 11/214 in W, \|W\|/\|G\| 0.02; CR-GC-999: 4/210 in W, \|W\|/\|G\| 0.033; Kalibrierung J1: 1/1 in W, \|W\|/\|G\| 0.846 | 2/10 Jobs: CR-GC-964: 8/183 in W, \|W\|/\|G\| 0.035; CR-GC-963: 2/2 in W, \|W\|/\|G\| 0.006; CR-GC-954: 21/186 in W, \|W\|/\|G\| 0.026; CR-GC-934: 7/165 in W, \|W\|/\|G\| 0.049; CR-GC-934: 7/64 in W, \|W\|/\|G\| 0.049; CR-GC-956: 3/3 in W, \|W\|/\|G\| 0.007; CR-GC-923: 3/163 in W, \|W\|/\|G\| 0.011; CR-GC-925: 1/161 in W, \|W\|/\|G\| 0.009; CR-GC-955: 3/161 in W, \|W\|/\|G\| 0.021; CR-GC-918: 103/299 in W, \|W\|/\|G\| 0.075; Kalibrierung J1: 1/1 in W, \|W\|/\|G\| 0.846 | 2026-11-22 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| — | T-H2 | jede Regel steht in der Matrix, jede genannte ID existiert | unbekannt CL-01 | unbekannt CL-01 | 2026-11-20 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |
| — | T-O1 | Referenzkette reproduziert; ≥ 90 % der Ketten auswertbar | Referenzkette reproduziert; 77 von 96 Ketten bewertbar (80 %, 10 Graphen); nicht gerechnet: syncDepth, errorPathDepth, answerPath | Referenzkette reproduziert; 77 von 96 Ketten bewertbar (80 %, 10 Graphen); nicht gerechnet: syncDepth, errorPathDepth, answerPath | 2026-11-20 | nicht bestanden | 2026-11-22 | graph c8552008f90c (1747/4489) · policy graphcode.config.jsonc · rules 54.2.0 · code fca80445+dirty |

## Ein Stand je Woche

Der letzte committete Stand von `docs/graph` je Kalenderwoche. „Befunde ohne Plan“ summiert alle Stufen außer Plan.

| Woche | Datum | Stand | Erreichte Marken | Befunde ohne Plan | Befunde Plan |
|---|---|---|---|---|---|
| 2026-W30 | 2026-07-26 | 1688511 | keine | 368 | 38 |
| 2026-W31 | 2026-07-29 | b37e822 | keine | 368 | 44 |
| 2026-W32 | 2026-08-08 | a1c73df | keine | 347 | 94 |
| 2026-W33 | 2026-08-16 | 3ac435a | keine | 478 | 97 |
| 2026-W34 | 2026-08-23 | 0f015a0 | keine | 472 | 1 |
| 2026-W35 | 2026-08-28 | f5e4c61 | keine | 679 | 0 |
| 2026-W36 | 2026-09-05 | 3c6b3b0 | keine | 588 | 0 |
| 2026-W37 | 2026-09-12 | 798a990 | keine | 358 | 0 |
| 2026-W38 | 2026-09-20 | 6698d3e | keine | 365 | 42 |
| 2026-W39 | 2026-09-27 | f4479d9 | SRR | 319 | 166 |
| 2026-W40 | 2026-10-04 | e6b680e | SRR | 298 | 202 |
| 2026-W41 | 2026-10-11 | e2baf2e | SRR | 241 | 262 |
| 2026-W42 | 2026-10-16 | 3da5e29 | SRR | 236 | 298 |
| 2026-W43 | 2026-10-25 | e25c307 | SRR PDR | 234 | 323 |
| 2026-W44 | 2026-10-29 | bc2fc9e | SRR PDR | 233 | 356 |
| 2026-W45 | 2026-11-04 | 0031bba | SRR PDR | 233 | 363 |
| 2026-W46 | 2026-11-15 | ad7e10e | SRR PDR | 217 | 425 |
| 2026-W47 | 2026-11-22 | fca8044 | SRR PDR | 102 | 453 |
