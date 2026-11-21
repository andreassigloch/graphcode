# Mutanten-Messung CR-GC-980

Muster CR-GC-958. Je Mutante eine Änderung am Quell-Schema (`src/projections/export.ts`, `verification-report.ts`, `testreport.ts`, `src/kernel/measure/working-set.ts`), einzeln eingespielt, danach zurückgenommen (Skript außerhalb des Repos, Quelle danach unverändert). Zahl = rote Fälle der Datei.

- **alt:** `tests/vertrag/SCHEMA-<name>.vertrag.test.ts` aus HEAD vor dem CR (Generator von CR-GC-962).
- **neu:** dieselbe Datei, mit dem Generator dieses CR neu erzeugt.
- **Hand vorher:** `tests/vertrag/SCHEMA-<name>.elemente.test.ts` vor dem Kürzen (24 Fälle in 3 Dateien).
- **Hand nachher:** dieselben Dateien nach dem Kürzen (13 Fälle).

Regeln (vor der ersten Zahl festgelegt): Strukturmutanten N und L (Pflichtfeld optional, Feld entfernt, Typ getauscht, Enum geweitet, Elementschema ersetzt) an der ersten verschachtelten Stelle und im ersten Listenelement; Wertmutanten W (min(1), nonnegative, int, positive entfernt, leere Liste verboten).

| Mutante | SCHEMA | Art | alt | neu | Hand vorher | Hand nachher |
|---|---|---|---|---|---|---|
| E-N1 | export-answer | Pflichtfeld optional (verschachtelt) | 0 | 1 | 0 | 0 |
| E-N2 | export-answer | Feld entfernt (verschachtelt) | 1 | 3 | 1 | 1 |
| E-N3 | export-answer | Typ getauscht (verschachtelt) | 1 | 2 | 2 | 2 |
| E-L1 | export-answer | Pflichtfeld optional (Listenelement) | 0 | 1 | 1 | 0 |
| E-L2 | export-answer | Feld entfernt (Listenelement) | 1 | 3 | 1 | 1 |
| E-L3 | export-answer | Typ getauscht (Listenelement) | 1 | 2 | 1 | 1 |
| E-L4 | export-answer | Enum geweitet (Listenelement) | 0 | 1 | 1 | 0 |
| E-L5 | export-answer | Typ getauscht (Liste von Text) | 1 | 2 | 0 | 0 |
| E-W1 | export-answer | Wertregel: min(1) entfernt (Listenelement) | 0 | 0 | 0 | 1 |
| E-W2 | export-answer | Wertregel: nonnegative entfernt (verschachtelt) | 0 | 0 | 1 | 1 |
| E-W3 | export-answer | Wertregel: positive zu nonnegative | 0 | 0 | 1 | 1 |
| E-W4 | export-answer | Wertregel: min(1) entfernt (Liste von Text) | 0 | 0 | 1 | 1 |
| E-W5 | export-answer | Wertregel: Liste darf nicht leer sein | 0 | 0 | nicht gemessen | 1 |
| T-N1 | test-ingest-answer | Pflichtfeld optional (Listenelement) | 0 | 2 | 1 | 0 |
| T-N2 | test-ingest-answer | Feld entfernt (Listenelement) | 1 | 5 | 1 | 0 |
| T-N3 | test-ingest-answer | Enum geweitet (Listenelement) | 0 | 2 | 1 | 0 |
| T-N4 | test-ingest-answer | Pflichtfeld optional (Listenelement, extend) | 0 | 1 | 1 | 0 |
| T-N5 | test-ingest-answer | Pflichtfeld optional (Listenelement) | 0 | 1 | 1 | 0 |
| T-N6 | test-ingest-answer | Typ getauscht (Listenelement) | 1 | 2 | 2 | 0 |
| T-N7 | test-ingest-answer | Elementschema ersetzt | 0 | 9 | 2 | 0 |
| T-W1 | test-ingest-answer | Wertregel: min(1) entfernt (Listenelement) | 0 | 0 | 0 | 1 |
| T-W2 | test-ingest-answer | Wertregel: nonnegative entfernt | 0 | 0 | 1 | 1 |
| T-W3 | test-ingest-answer | Wertregel: Liste darf nicht leer sein | 0 | 0 | nicht gemessen | 1 |
| W-N1 | work-set | Typ getauscht (Liste von Text) | 1 | 2 | 2 | 0 |
| W-N2 | work-set | Elementschema ersetzt | 0 | 1 | 2 | 1 |
| W-W1 | work-set | Wertregel: min(1) entfernt (Liste von Text) | 0 | 0 | 1 | 1 |
| W-W4 | work-set | Wertregel: Liste darf nicht leer sein | 0 | 0 | nicht gemessen | 1 |
| W-W2 | work-set | Wertregel: nonnegative entfernt | 0 | 0 | 1 | 1 |
| W-W3 | work-set | Wertregel: int entfernt | 0 | 0 | 1 | 1 |

## Summe

| Art | Mutanten | alt rot | neu rot | Hand vorher rot | Hand nachher rot |
|---|---|---|---|---|---|
| Struktur (N, L) | 17 | 8 | 17 | 15 | 0 (nicht nötig) |
| Wertregel (W) | 12 | 0 | 0 | 7 von 9 gemessen | 12 |

Hand vorher fing von 9 gemessenen Wertmutanten 7; E-W1 und T-W1 (leerer Pfad, leerer Grund) fing kein Handfall. E-W5, T-W3 und W-W4 waren vor dem Kürzen nicht eingespielt. Nach dem Kürzen und zwei neuen Fällen fängt Hand 12 von 12.
