# CR-GC-986: SCHEMA-cli-command haengt an Fluessen, die kein CLI-Verb tragen

**Typ:** aus Item ITEM-2026-1551 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1551.json (Lane: code)

---

## Befund

Offener Punkt aus CR-GC-984. `SCHEMA-cli-command` (`CliVerbSchema`, die 11 Verben der CLI) hing nach CR-GC-984 noch an sieben FLOW, die kein Verb tragen. Je FLOW am Code geprüft (Stand graphVersion 1425: R-26 8, R-32 11, RC-04 15):

| FLOW | Was wird übergeben | Beleg | Weg | Stand |
|---|---|---|---|---|
| `FLOW-import-summary` | `ImportCodeSummary`, das Ergebnis von `executeImportCode` an die CLI, die es auf stderr schreibt | `import-code-verb.ts` `executeImportCode` (Rückgabe), `cli.ts:148` | 2 | erledigt: `SCHEMA-import-summary`, Parse im Erzeuger |
| `FLOW-render-file` | `RenderSummary` (Sicht, Format, Pfad, Größe, Vorlage) samt geschriebener Datei | `render-verb.ts` `executeRender` (Rückgabe), `cli.ts:176` | 2 | erledigt: `SCHEMA-render-summary`; die Datei hat keine Datenform, der Vertrag ist die Zusammenfassung |
| `FLOW-cli-output` | Ausgabe aller Verben: Text (`formatStatus`, `formatUpgrade`, `formatInit`) und JSON von `InstallResult`, `RewindSummary`, Import- und Render-Zusammenfassung, Vertragstest-Bericht | `cli.ts:92-312` (jede Verbzeile schreibt etwas anderes) | 4 | vorgelegt: ein FLOW trägt mehrere Werte, bleibt an `SCHEMA-cli-command` |
| `FLOW-gve-attach` | `repoRoot` als Pfad-Zeichenkette an `attachGve(repoRoot)` | `mcp-server.ts:264` | 3 | vorgelegt: kein Datenvertrag, bleibt |
| `FLOW-gve-stop` | Aufruf `gve.stop()` beim Sitzungsende, ohne Wert | `gve.ts` `GveHandle.stop`, `mcp-server.ts` `serveStdio` | 3 | vorgelegt, bleibt |
| `FLOW-session-end` | Signal oder Schließen des stdio-Clients | `session-lifecycle.ts` `installTriggers` | 3 | vorgelegt, bleibt |
| `FLOW-viewer-start` | Start und Ende des Viewer-Prozesses | `gve.ts` `ensureViewer`, `attachGve` | 3 | vorgelegt, bleibt |

## Änderung

**Code (2 Quelldateien).** `import-code-verb.ts`: `ImportCodeSummarySchema` (Status und Befunde aus `ImportResultSchema` von graphify, nicht nachgebaut); das `interface ImportCodeSummary` ist `z.infer`; `executeImportCode` parst die Zusammenfassung vor der Rückgabe und gibt das Original zurück. `render-verb.ts`: `RenderSummarySchema` mit `MarkdownViewSchema` und `RENDER_FORMATS`, das `interface RenderSummary` entfällt, `executeRender` parst. Verwender der Typen: nur diese Dateien (grep).

**Modell.** `SCHEMA-import-summary` und `SCHEMA-render-summary` mit `realRef`; `FLOW-import-summary` und `FLOW-render-file` umgebunden (delete-edge und add-edge in einem Batch); je ein TEST mit `verify`; CR-Kanten auf beide neuen SCHEMA, `SCHEMA-cli-command`, `FUNC-import-code-verb`, `FUNC-render-verb`.

**Tests (4 Dateien, davon 2 erzeugt).** Erzeugt: `SCHEMA-import-summary.vertrag.test.ts` (32 Fälle), `SCHEMA-render-summary.vertrag.test.ts` (14), Fan-out. Von Hand: `SCHEMA-import-summary.elemente.test.ts` (6 Fälle), `SCHEMA-render-summary.elemente.test.ts` (4): Zähler, Zählung je Typ, Status, Befund je Element, leere Pfade, Format, Sicht, Größe, Vorlage null. Gezählt: 2 Quell-, 2 Handdateien.

## Nachweis rot-zuerst

Mutanten, je zurückgenommen (Prüfmenge: vier Vertragsdateien, `render-verb.test.ts`, `import-code-verb.test.ts`):

| Mutante | Ergebnis |
|---|---|
| Render: `bytes` negativ erzeugt | 2 rot (der Erzeuger wirft) |
| Import: `applied.nodes` negativ erzeugt | 6 rot |
| `extracted` ohne int und positive | 1 rot (Hand) |
| `files` ohne int und positive | 1 rot (Hand) |
| `status` als String | 2 rot |
| `format` als String | 2 rot |
| `vorlage` optional statt nullable | 5 rot |
| `bytes` ohne int und nonnegative | 1 rot (Hand) |

## Akzeptanz

- [x] Regeln (`rules_evaluate` grouped, graphVersion 1427): R-26 8, R-32 11, RC-04 15, CR-01 (Grenze agent-surface/surface) 11, R-04 an MOD-agent-surface 21 — alle unverändert. Die zwei neuen SCHEMA waren von Anfang an gebunden, geparst und verifiziert und kamen in keine Liste; ihre Bindung ersetzt nur die falsche an `SCHEMA-cli-command`. Danach hängen fünf FLOW (`FLOW-cli-output`, `FLOW-gve-attach`, `FLOW-gve-stop`, `FLOW-session-end`, `FLOW-viewer-start`) weiter an `SCHEMA-cli-command`, vorgelegt.
- [x] `npm run type-check` und `npm run build` grün (ein ungenutzter Typ-Import in `render-verb.ts` entfernt).
- [x] `verify:code` grün: 73 Dateien, 1035 Tests, Bindung 2/2, Rückmeldung 57 Ergebnisse, 0 zurückgenommen. Kein Volllauf je CR (nach CR-GC-985 elf CODE-CR ohne Schlupf).
- [x] Smoke: `node dist/cli.js status` startet; `render srs --format xyz` endet mit der Meldung „unbekanntes Format“ (ungültig); der gültige Aufruf scheitert am Host, der den Store hält („store already owned“, erwartet, solange der Host läuft), den gültigen Fall mit Parse belegen `tests/render-verb.test.ts` und `tests/import-code-verb.test.ts` am echten Store.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| `FLOW-cli-output` trägt je Verb einen anderen Wert. Aufteilen in einen FLOW je Verb mit den vorhandenen SCHEMA (`SCHEMA-repo-status`, `SCHEMA-upgrade-report`, `SCHEMA-init-report`, `SCHEMA-install-result`, `SCHEMA-rewind-summary`, `SCHEMA-import-summary`, `SCHEMA-render-summary`, `SCHEMA-vertragstest-bericht`)? | offen, beim Autor | FAQ `flow-ein-schema`, `vertrag-je-variante`: neue FLOW sind eine Architekturentscheidung |
| `FLOW-gve-attach`, `FLOW-gve-stop`, `FLOW-session-end`, `FLOW-viewer-start` tragen keine Datenform (Pfad, Aufruf, Signal, Prozessstart). Kanal-Attribut am FLOW (ITEM-2026-1476), anderes Ziel oder FLOW streichen? | offen, beim Autor | FAQ `fluss-nur-mit-codebeleg`, `element-erfinden-fuer-regel`: kein Schema erfunden; bis zur Entscheidung hängen sie an `SCHEMA-cli-command` (R-18: ein FLOW, ein SCHEMA) |
| `FLOW-render-file`: der Vertrag ist die Zusammenfassung, nicht die Datei | umgesetzt, Autor bestätigt oder verwirft | die Datei hat keine Datenform; ihr Ort und ihre Größe stehen in der Zusammenfassung |

---

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-cli-command)` vor dem CR: `FLOW-cli-command` (trägt das Verb, richtig), die sieben FLOW der Tabelle, CR-GC-959 und CR-GC-984. `FUNC-import-code-verb` und `FUNC-render-verb` sind die Erzeuger. Verhalten der CLI unverändert: gleiche Ausgabe, gleiche Exit-Codes.
