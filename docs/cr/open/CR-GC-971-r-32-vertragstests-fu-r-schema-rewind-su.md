# CR-GC-971: R-32: Vertragstests für SCHEMA-rewind-summary und SCHEMA-test-ingest-input fehlen

**Typ:** aus Item ITEM-2026-1511 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1511.json (Lane: code)

---

## Befund

R-32 meldete 23 SCHEMA ohne Vertragstest (graphVersion 1358). Zwei davon liegen im Repo selbst, mit Zod-Schema im Code:

- `SCHEMA-rewind-summary` (`src/surface/rewind.ts#RewindSummarySchema`): der Generator (`graphcode vertragstest`) kann es.
- `SCHEMA-test-ingest-input` (`src/projections/testreport.ts#GraphTestIngestInputSchema`): der Generator kann es nicht, weil zwei `refine` verlangen, dass genau eines von `report` und `results` fehlt oder steht und mindestens eines von `report`, `results`, `changeSet` da ist („kein angenommenes Beispiel“). Der Test ist von Hand zu schreiben (FAQ `schema-vertragstest-pflicht`, CR-GC-964 und CR-GC-965 für den Weg von Hand).

Die übrigen 21 sind nicht Teil dieses CR: 9 sind `external` mit Code im Paket `@sigloch/*` (Generator löst sie nicht auf), 11 haben keinen `realRef` (R-26), 1 ist Rest der Zählung.

## Änderung

| Datei | Was |
|---|---|
| `tests/vertrag/SCHEMA-rewind-summary.vertrag.test.ts` | neu, mit `node dist/cli.js vertragstest SCHEMA-rewind-summary` erzeugt: 11 Fälle (Beispiel, Ablehnung je Pflichtfeld, falscher Typ); der Generator verwirft „unbekanntes Zusatzfeld“, weil das Schema nicht `strict` ist |
| `tests/vertrag/SCHEMA-test-ingest-input.vertrag.test.ts` | neu, von Hand: 7 angenommene Varianten (nur report, nur results mit tool und evidence, nur changeSet, results mit changeSet, report mit changeSet, leeres results, Vorgaben überschrieben) und 16 Ablehnungen (keins, nur consumerId und dryRun, report und results zugleich, falscher Typ je Feld, leeres file, fehlendes oder unbekanntes result, leeres tool, leere evidence, leeres changeSet, leere uid) |

Modell (graphVersion 1360 → 1361): `TEST-vertrag-rewind-summary` und `TEST-vertrag-test-ingest-input`, je mit `verify` auf ihr SCHEMA und `testRefs` auf die Datei (`tool: vitest`, `level: unit`), wie die sieben vorhandenen (z. B. `TEST-vertrag-repo-status`).

## Nachweis rot-zuerst

Kein Code geändert, daher Mutanten am Schema, je zurückgenommen (`git diff src` leer):

| Mutante | Ergebnis |
|---|---|
| `RewindSummarySchema`: `forced` optional | 1 von 11 rot („lehnt ab ohne forced“) |
| `GraphTestIngestInputSchema`: beide `refine` auf `true` | 1 rot („report und results zugleich“) |
| nur das „mindestens eines“-`refine` auf `true` | 2 rot („keins“, „nur consumerId und dryRun“) |
| `changeSet` ohne `.min(1)` | 2 rot („changeSet leer“, „leere uid“) |

## Akzeptanz

- [x] Beide Dateien grün, vorher je aus dem richtigen Grund rot gesehen (Mutanten oben).
- [x] `verify:code` grün (58 Dateien, 522 Tests); `verify:full CR-GC-971` grün (248 Dateien, 2160 Tests), Schlupf 0, Link-Modus nein.
- [x] R-32 von 23 auf 21 (`rules_evaluate`, graphVersion 1361).

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

Nur neue Testdateien und zwei TEST-Knoten; kein Quellcode geändert. Relation-Kanten: `SCHEMA-rewind-summary`, `SCHEMA-test-ingest-input`. Beide SCHEMA haben vorher keinen TEST (`graph_context`: ohne `verify`-Gegenkante).
