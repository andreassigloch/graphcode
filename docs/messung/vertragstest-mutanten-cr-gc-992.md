# Mutanten-Messung CR-GC-992

`SCHEMA-test-ingest-input` (`GraphTestIngestInputSchema`, `src/projections/testreport.ts`). Je Mutante eine Änderung am Quell-Schema, einzeln eingespielt, danach zurückgenommen (Skript außerhalb des Repos; `git status` zeigt danach nur die Änderungen des CR). Nie in `node_modules`. Zahl = rote Fälle der Datei.

- **alt (Hand):** `tests/vertrag/SCHEMA-test-ingest-input.vertrag.test.ts` aus HEAD vor dem CR, von Hand, 23 Fälle, gegen das alte Schema mit zwei `.refine`. Das alte Schema lief dafür in einem Wegwerf-Modul unter `tests/`, das danach gelöscht wurde.
- **neu (erzeugt):** dieselbe Datei, aus dem neuen Schema erzeugt, 73 Fälle. Der Erzeuger kennt dafür seit CR-GC-994 die Werteliste eines `z.literal`.

Das neue Schema hat eine Vereinigung über `art`. Drei der geforderten Mutanten haben im alten Schema keine Entsprechung (keine Variante, kein Art-Wert); die Spalte „alt“ steht dort auf „–“.

| Mutante | Änderung | alt (Hand) | neu (erzeugt) |
|---|---|---|---|
| V1 | Variante `withdraw` entfernt | – | 4 |
| V2 | Pflichtfeld `results` der Variante `results` optional | – | 2 |
| V3 | Pflichtfeld `changeSet` der Variante `withdraw` optional | – | 1 |
| V4 | Art-Wert erweitert: `z.literal(['withdraw', 'x'])` | – | 1 |
| V5 | Art-Wert umbenannt: `report` → `bericht` | – | 10 |
| V6 | Variante `report` lässt ein Zusatzfeld zu (`z.object` statt `z.strictObject`) | – | 1 |
| S1 | `changeSet` ohne `min(1)` | 1 | 3 |
| S2 | `consumerId` ohne Vorgabe | 1 | 1 |
| S3 | `tool` ohne `min(1)` | 1 | 1 |
| S4 | `results[].file` ohne `min(1)` | 1 | 1 |
| R1 | alt: `.refine` „höchstens eines“ entfernt | 1 | – |
| R2 | alt: `.refine` „mindestens eines“ entfernt | 2 | – |

Unverändertes Schema: alt 0 rot von 23, neu 0 rot von 73. Alle Mutanten V1–V6 und S1–S4 sind im erzeugten Test rot. Der Art-Wert V4 ist erst seit CR-GC-994 fassbar: ohne die eingefrorene Werteliste des `z.literal` bliebe er grün.
