# Mutanten-Messung CR-GC-987

Fortsetzung von `vertragstest-mutanten-cr-gc-980.md`. Je Mutante eine Änderung am Quell-Schema (`src/projections/export.ts`, `testreport.ts`, `verification-report.ts`, `exporter.ts`, `src/kernel/measure/working-set.ts`, `steering-snapshot.ts`, `src/surface/render-verb.ts`, `import-code-verb.ts`, `mutate-answer.ts`), einzeln eingespielt, danach zurückgenommen (Skript außerhalb des Repos; `git status` zeigt danach nur die Änderungen des CR). Nie in `node_modules`. Zahl = rote Fälle der Datei.

- **alt:** `tests/vertrag/SCHEMA-<name>.vertrag.test.ts` aus HEAD vor dem CR (Generator von CR-GC-980).
- **neu:** dieselbe Datei, mit dem Generator dieses CR neu erzeugt.
- **Hand:** `tests/vertrag/SCHEMA-<name>.elemente.test.ts` vor dem Löschen (36 Fälle in 6 Dateien); nach dem CR gibt es keine mehr.

Die Mutanten E-N*, E-L*, T-N*, W-N*, E-W*, T-W*, W-W* sind die 29 aus CR-GC-980 (Struktur 17, Wertregel 12), mit denselben Änderungen am Quell-Schema nachgebaut (das Skript von CR-GC-980 liegt nicht im Repo; „Enum geweitet“ heißt dort: Enum durch `z.string()` ersetzt). Neu dazu: Mutanten an den Schemas, deren Handdatei dieser CR löscht (R-*, I-*, M-*, `E-O1`), Mutanten für Optionalität (Feld optional → Pflicht, `nullable` entfernt) und für „Enum um einen Wert erweitert“ (E-E1, R-E1).

### Wertregel

| Mutante | SCHEMA | Änderung | alt | neu | Hand (vor dem Löschen) |
|---|---|---|---|---|---|
| M-W1 | mutate-answer | openRefs: nonnegative entfernt | 0 | 1 | 1 |
| M-W2 | mutate-answer | openRefs: int entfernt | 0 | 1 | 1 |
| M-W3 | mutate-answer | stages: leerer Record verboten | 0 | 1 | 1 |
| R-W1 | render-summary | bytes: nonnegative entfernt | 0 | 1 | 1 |
| R-W2 | render-summary | bytes: int entfernt | 0 | 1 | 1 |
| R-W3 | render-summary | out: min(1) entfernt | 0 | 1 | 1 |
| R-W4 | render-summary | vorlage: min(1) entfernt | 0 | 1 | 1 |
| I-W1 | import-summary | files: positive zu nonnegative | 0 | 1 | 1 |
| I-W2 | import-summary | files: int entfernt | 0 | 1 | 1 |
| I-W3 | import-summary | extracted: positive zu nonnegative | 0 | 1 | 1 |
| I-W4 | import-summary | extracted: int entfernt | 0 | 1 | 1 |
| I-W5 | import-summary | applied.nodes: nonnegative entfernt | 0 | 1 | 1 |
| I-W6 | import-summary | applied.edges: int entfernt | 0 | 1 | 1 |
| I-W7 | import-summary | backupPath: min(1) entfernt | 0 | 1 | 1 |
| I-W8 | import-summary | exportPath: min(1) entfernt | 0 | 1 | 1 |
| I-W9 | import-summary | exportError: min(1) entfernt | 0 | 1 | 1 |
| E-W1 | export-answer | min(1) entfernt (Listenelement) | 0 | 1 | 1 |
| E-W2 | export-answer | nonnegative entfernt (verschachtelt) | 0 | 1 | 1 |
| E-W3 | export-answer | positive zu nonnegative | 0 | 1 | 1 |
| E-W4 | export-answer | min(1) entfernt (Liste von Text) | 0 | 1 | 1 |
| E-W5 | export-answer | Liste darf nicht leer sein | 0 | 1 | 1 |
| T-W1 | test-ingest-answer | min(1) entfernt (Listenelement) | 0 | 1 | 1 |
| T-W2 | test-ingest-answer | nonnegative entfernt | 0 | 1 | 1 |
| T-W3 | test-ingest-answer | Liste darf nicht leer sein | 0 | 1 | 1 |
| W-W1 | work-set | min(1) entfernt (Liste von Text) | 0 | 1 | 1 |
| W-W4 | work-set | Liste darf nicht leer sein | 0 | 1 | 1 |
| W-W2 | work-set | nonnegative entfernt | 0 | 1 | 1 |
| W-W3 | work-set | int entfernt | 0 | 1 | 1 |

### Optionalität

| Mutante | SCHEMA | Änderung | alt | neu | Hand (vor dem Löschen) |
|---|---|---|---|---|---|
| R-O1 | render-summary | vorlage: nullable entfernt | 0 | 1 | 1 |
| I-O1 | import-summary | backupPath: optional entfernt | 0 | 1 | 1 |
| I-O2 | import-summary | exportError: optional entfernt | 0 | 1 | 4 |
| E-O1 | export-answer | unfedMutations: optional entfernt | 0 | 1 | 1 |

### Enum

| Mutante | SCHEMA | Änderung | alt | neu | Hand (vor dem Löschen) |
|---|---|---|---|---|---|
| R-E1 | render-summary | format: um einen Wert erweitert | 0 | 1 | 1 |
| E-E1 | export-answer | Enum um einen Wert erweitert (eigenes Schema) | 0 | 1 | 0 |

### Struktur

| Mutante | SCHEMA | Änderung | alt | neu | Hand (vor dem Löschen) |
|---|---|---|---|---|---|
| M-N1 | mutate-answer | resolved: Typ getauscht | 11 | 152 | 1 |
| E-N1 | export-answer | Pflichtfeld optional (verschachtelt) | 1 | 1 | 0 |
| E-N2 | export-answer | Feld entfernt (verschachtelt) | 3 | 16 | 1 |
| E-N3 | export-answer | Typ getauscht (verschachtelt) | 2 | 13 | 2 |
| E-L1 | export-answer | Pflichtfeld optional (Listenelement) | 1 | 1 | 0 |
| E-L2 | export-answer | Feld entfernt (Listenelement) | 3 | 15 | 0 |
| E-L3 | export-answer | Typ getauscht (Listenelement) | 2 | 12 | 1 |
| E-L4 | export-answer | Enum geweitet zu Text (Listenelement) | 1 | 2 | 0 |
| E-L5 | export-answer | Typ getauscht (Liste von Text) | 2 | 12 | 0 |
| T-N1 | test-ingest-answer | Pflichtfeld optional (Listenelement) | 1 | 1 | 0 |
| T-N2 | test-ingest-answer | Feld entfernt (Listenelement) | 3 | 31 | 1 |
| T-N3 | test-ingest-answer | Enum geweitet zu Text (Listenelement) | 2 | 4 | 0 |
| T-N4 | test-ingest-answer | Pflichtfeld optional (Listenelement, extend) | 1 | 1 | 0 |
| T-N5 | test-ingest-answer | Pflichtfeld optional (Listenelement) | 2 | 2 | 0 |
| T-N6 | test-ingest-answer | Typ getauscht (Listenelement) | 2 | 29 | 0 |
| T-N7 | test-ingest-answer | Elementschema ersetzt | 9 | 13 | 0 |
| W-N1 | work-set | Typ getauscht (Liste von Text) | 2 | 4 | 0 |
| W-N2 | work-set | Elementschema ersetzt | 1 | 2 | 1 |

## Summe

| Art | Mutanten | alt rot (>=1) | neu rot (>=1) | Hand vorher rot |
|---|---|---|---|---|
| Wertregel | 28 | 0 | 28 | 28 |
| Optionalität | 4 | 0 | 4 | 4 |
| Enum | 2 | 0 | 2 | 1 |
| Struktur | 18 | 18 | 18 | 6 |

## Die 29 Mutanten aus CR-GC-980

| Art | Mutanten | alt rot | neu rot |
|---|---|---|---|
| Wertregel (E-W1 bis E-W5, T-W1 bis T-W3, W-W1 bis W-W4: 12) | 12 | 0 | 12 |
| Struktur (E-N, E-L, T-N, W-N: 17) | 17 | 17 | 17 |

„alt“ der Struktur-Mutanten ist 17 von 17, weil HEAD den Generator von CR-GC-980 trägt (damals: 8 von 17). Jede Wertregel-Mutante färbt genau 1 Fall der neuen Datei rot: den Grenzfall der geänderten Regel.

## Enum um einen Wert erweitert

Ursache der Lücke aus CR-GC-981: Der Fall „Wert außerhalb des Enums wird abgelehnt“ prüft `'__ausserhalb__'`. Ein Enum mit einem Wert mehr lehnt diesen Text weiter ab; kein Parse-Fall kann einen unbekannten, hinzugekommenen Wert nennen. Die Enum-Mutanten aus CR-GC-980 (Enum durch `z.string()` ersetzt) nehmen `'__ausserhalb__'` an und fallen deshalb auf. E-E1 (`MarkdownViewSchema` um `'zusatz'` erweitert) und R-E1 (`RENDER_FORMATS` um `'html'`): alt 0, neu 1, also gefangen. Der Erzeuger schreibt je Enum die Werteliste als eingefrorene Liste in die Datei (`Werteliste unverändert`).
