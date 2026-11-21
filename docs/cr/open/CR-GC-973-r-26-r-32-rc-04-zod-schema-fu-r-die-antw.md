# CR-GC-973: R-26, R-32, RC-04: Zod-Schema für die Antworten von graph_export und graph_test_ingest

**Typ:** aus Item ITEM-2026-1519 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1519.json (Lane: code)

---

## Befund

Entscheidung des Autors vom 2026-11-21 (FAQ `bindungsregeln-ab-realisierung`, Punkt 2): Das Zod-Schema eines Datenvertrags ist Teil der Spezifikation und wird geschrieben und gebunden. Sechs SCHEMA haben im Code schon einen TS-Typ, aber kein Zod-Schema und keinen `realRef`. Sie gehen in zwei CR nach Modul: dieser CR (projections) nimmt zwei, CR-GC-974 (loop, kernel) zwei weitere. `SCHEMA-steering-channel` und `SCHEMA-audit-record` bleiben aus, Gründe im Bericht von CR-GC-974.

Stand graphVersion 1371: R-26 11, R-32 21, RC-04 23.

| SCHEMA | Code vorher | Beschreibung gegen Code |
|---|---|---|
| `SCHEMA-export-answer` | Inline-Typ im Handler `graph_export` (`src/projections/export.ts`) | Beschreibung nannte keine Felder: nachgezogen (graphJson, views, stubs, unfedMutations nur bei Wert über 0) |
| `SCHEMA-test-ingest-answer` | Inline-Typ im Handler `graph_test_ingest` (`src/projections/testreport.ts`) | Beschreibung nannte `bindings` nicht: nachgezogen; der Satz „Im Code heute ohne Zod-Vertrag (ITEM-2026-982)“ entfällt |

## Änderung

**Code (3 Quelldateien).**

- `export.ts`: `GraphExportAnswerSchema`; der Inline-Typ im `MCPTool` ist `z.infer` daraus. Der Handler gibt `GraphExportAnswerSchema.parse({...})` zurück. `view` nutzt das vorhandene `MarkdownViewSchema` aus `exporter.ts`.
- `testreport.ts`: `GraphTestIngestAnswerSchema`; der Inline-Typ ist `z.infer`. Beide `return` des Handlers parsen. `tier` und `violations` kommen aus `@sigloch/contracts/harness` (`MutateTier`, `RuleViolationSchema`), nicht nachgebaut.
- `verification-report.ts`: die Interfaces `TestResultAssignment`, `TestRefBinding`, `TestResultWithdrawal` sind Zod-Schemas mit abgeleitetem Typ (gelöscht: die Interfaces). Sie sind Teile der Antwort; ein zweiter Satz Typen daneben wäre ein paralleler Pfad. Verwender: nur dieselbe Datei und `testreport.ts` (grep).

Der Parse sitzt im Erzeuger, in der Datei der io-verbundenen FUNC (`FUNC-graph-export-snapshot`, `FUNC-test-ingest`); die Schemas stehen in derselben Datei (FAQ `rc04-parse-an-der-grenze`, Variante 5).

**Modell.** `realRef` an beide SCHEMA, Beschreibung nachgezogen, je ein TEST (`TEST-vertrag-export-answer`, `TEST-vertrag-test-ingest-answer`) mit `verify` und `testRefs`, relation-Kanten dieses CR auf die zwei SCHEMA und die zwei FUNC. Weder SCHEMA trug `concept`.

**Tests.** Der Generator (`graphcode vertragstest`) erzeugt je SCHEMA eine Datei (8 und 19 Fälle). Er prüft nur die Felder der ersten Ebene; ein Mutant an `bindings[].tool` blieb grün. Darum je eine Datei von Hand (`*.elemente.test.ts`, 7 und 11 Fälle) für Elemente der Listen, den Zähler `unfedMutations` (0 abgelehnt) und das Gate-Urteil. Beide Dateien hängen am selben TEST (zwei `testRefs`).

## Nachweis rot-zuerst

Mutanten am Schema, je zurückgenommen (`git diff` zeigt nur die Änderung dieses CR):

| Mutante | Ergebnis |
|---|---|
| Export: `stubs` optional | 1 rot (Generator: „lehnt ab ohne stubs“) |
| Ingest: `success` optional | 1 rot (Generator: „lehnt ab ohne success“) |
| Ingest: `tool` der Bindung optional | Generator-Datei grün; Handdatei 1 rot („Bindung ohne tool“) |
| Export: `unfedMutations` ab 0 erlaubt | Handdatei 1 rot |
| Export: `view` als beliebiger String | Handdatei 1 rot („unbekannte Sicht“) |
| Ingest: `tier` als beliebiger String | Handdatei 1 rot |
| Ingest: `reason` optional | Handdatei 1 rot |
| Verdrahtung Export: `nodes` als String | `tests/mcp.export.test.ts` 3 von 3 rot (der Handler parst wirklich) |
| Verdrahtung Ingest: `graphVersion` als String | `tests/testreport.test.ts` 7 von 11 rot |

## Akzeptanz

- [x] R-26 von 11 auf 9, R-32 von 21 auf 19 (`rules_evaluate` grouped, graphVersion 1375). RC-04 bleibt bei 23: beide SCHEMA waren vorher ungebunden und standen nicht in der Liste; mit `realRef` und Parse im Handler kommen sie nicht hinzu (sonst 25). Sonst bewegte sich keine Regel.
- [x] `npm run type-check` grün; Verträge grün, vorher rot gesehen (Mutanten oben).
- [x] `verify:code` grün (96 Dateien, 847 Tests, Bindung 3/3, Rückmeldung 80 Ergebnisse, 0 zurückgenommen).
- [x] `verify:full CR-GC-973` grün (253 Dateien, 2215 Tests), Schlupf 0, Link-Modus nein; Folge ohne Schlupf 6/10.
- [x] Smoke: nach dem Build startet `node dist/cli.js status` ohne Fehler (meldet erwartet Drift: der Host hat den alten Code geladen). Den neuen Parse belegen die Tests; der Host wurde nicht neu gestartet. `graph_export` antwortet über den laufenden Host.

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-export-answer)`: FLOW `FLOW-export-answer`, `FLOW-export-write-slot`; FUNC `FUNC-graph-export-snapshot` (realRef `graph_export`). `graph_impact(SCHEMA-test-ingest-answer)`: FLOW `FLOW-test-ingest-answer`, `FLOW-meldung`; FUNC `FUNC-test-ingest` und `FUNC-aenderung-melden` (Empfänger, Skript `scripts/aenderung-melden.mjs`, liest die Antwort als Objekt, nicht vom Typ abhängig). `graph_tests`/`verify:code --plan`: 96 von 253 Testdateien, Bindung 3/3 Quelldateien.
