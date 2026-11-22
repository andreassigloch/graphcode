# CR-GC-1007: Sechs fehlende Vertragstests erzeugen und binden

**Typ:** aus Item ITEM-2026-1593 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1593.json (Lane: graph)

---

Sechs SCHEMA ohne Vertragstest bekommen den erzeugten Test (FAQ `schema-vertragstest-pflicht`): `SCHEMA-real-ref`, `SCHEMA-test-refs`, `SCHEMA-test-selection`, `SCHEMA-format-e`, `SCHEMA-completeness`, `SCHEMA-readiness-report`. Voraussetzung: CR-GC-1005 (Format-E-Tür) und CR-GC-1006 (`realRef` der beiden Readiness-SCHEMA).

## Änderung

- `graphcode vertragstest SCHEMA-real-ref SCHEMA-test-refs SCHEMA-test-selection SCHEMA-format-e SCHEMA-completeness SCHEMA-readiness-report` (Exit 0, kein Abbruch): sechs Dateien unter `tests/vertrag/`, nicht von Hand. Importe aus `@sigloch/contracts/se`, `@sigloch/graph-api-core`, `@sigloch/graphcode-client` und `src/kernel/measure/test-selection.ts`.
- Modell: sechs TEST (`TEST-vertrag-<name>`) mit `testRefs` auf die Dateien und `verify` auf das SCHEMA; CR-Knoten mit Kanten auf die sechs SCHEMA. Das Ergebnis je TEST schreibt `verify:code` über `graph_test_ingest`.
- `tests/test-selection.audit.test.ts`: die Auswahl für `format-e-commands.ts` nennt jetzt auch `SCHEMA-format-e.vertrag.test.ts` (Vorbild CR-GC-1000). Kein Quelltext geändert.

## Messung

| | vorher | nachher |
|---|---|---|
| Dateien unter `tests/vertrag` | 34 | 40 |
| Fälle (vitest, `tests/vertrag/`) | 2814 | 3120 |
| Fälle je neue Datei | | completeness 32, format-e 48, readiness-report 68, real-ref 16, test-refs 37, test-selection 105 |
| `verworfen` über die 40 Dateien | 12 | 15 (completeness 1, readiness-report 2: je `context` mit falschem Typ) |
| SCHEMA ohne erzeugten Test (Datei `tests/vertrag/<uid>.vertrag.test.ts`) | 45 | 39 |
| R-32 | 10 | 8 (completeness und readiness-report weg; die vier anderen hatten schon einen von Hand gebundenen TEST) |

Ziel 0 ist nicht erreicht: 39 SCHEMA haben keine erzeugte Datei. 31 davon tragen ein `realRef` mit Symbol (der Lauf `graphcode vertragstest` ohne uids in ein Wegwerf-Verzeichnis erzeugt für alle 71 SCHEMA mit `realRef` ohne Abbruch, 5130 Fälle, 16 `verworfen`); 8 tragen kein `realRef` (`SCHEMA-action`, `audit-record`, `import-access`, `measurement-vector`, `query-params`, `skill-text`, `steering-channel`, `suggest-answer`). Nicht Teil dieses CR (Auftrag: sechs).

## Entscheidungen

keine.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1522, Tiefe 1, Wurzeln: `SCHEMA-real-ref`, `SCHEMA-test-refs`, `SCHEMA-test-selection`, `SCHEMA-format-e`, `SCHEMA-completeness`, `SCHEMA-readiness-report`._

Reichweite: 7 Elemente (FLOW 7); Blackbox-Rand 7, nicht geoeffnet.

Dateien (realRef, 5):
- packages/contracts/src/se/ontology.ts
- packages/graph-api-core/src/format-e-door.ts
- packages/graphcode-client/src/readiness.ts
- src/kernel/measure/test-selection.ts
- src/surface/host-shim.ts

Tests (`graph_tests`, 3):
- tests/attributvertraege.test.ts
- tests/mcp.mutate-input.test.ts
- tests/test-selection.audit.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
