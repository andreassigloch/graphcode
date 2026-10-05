# CR-GC-744: Nachzug contracts 10.15 — das Attribut `concept` entfällt; kein Leser, kein Hinweis mehr

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-756 (finding)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-756.json (Lane: code)
**Deckt:** contracts CR-SM-393 (`concept` aus `ELEMENT_ATTRIBUTES` an TEST/FUNC/MOD/SCHEMA/REQ, `ONTOLOGY_VERSION`
11.0.0, `RULES_VERSION` 37.0.0). Voraussetzung CR-GC-743 (Vorbedingung „Realisierung begonnen").
**Lösch-CR, über 10 Dateien:** ein Attribut-Wegfall ist ein Fan-out über einen Namen; jeder Zwischenstand
(Regel meldet, Export überspringt; Hilfe bietet an, was nichts bewirkt) ist ein Widerspruch.

---

## Befund

`concept: true` nahm ein Element aus R-19/R-20/R-26/RC-10. Der Katalog liest es nicht mehr; graphcode las es noch an
vier Stellen und bot es an drei weiteren als Ausweg an:

- `exporter.ts`: kein `it.todo`-Stub für eine gebundene `concept`-TEST, kein Zod-Stub für ein gebundenes
  `concept`-SCHEMA — die Regel meldet die Bindung, der Export materialisiert sie nicht.
- `report.ts` (`graph_tests`): eigener Grund „concept-only" unter `unresolved`.
- `incose.ts` (ICD): Zelle „Konzept (noch kein Zod-Export)" statt R-26-Marke.
- `help-content.ts`: `HELP_ELEMENT_STATES` erklärte `concept:true` als Zustand.
- Seed-/Fehlertexte (`mcp-server.ts`, `harness-import.ts`), `scaffold-docs.ts` (geht in jedes `GRAPHCODE.md`),
  sechs Skilltexte.

## Umsetzung

| Datei | Änderung |
|---|---|
| `src/projections/exporter.ts` | `concept`-Sprung an TEST- und SCHEMA-Stub entfernt; `external` bleibt am SCHEMA |
| `src/projections/report.ts` | ein Grund für ungebundene TESTs: `no testRefs attribute` |
| `src/projections/incose.ts` | „Konzept"-Zelle entfernt; die R-26-Marke steht nur, wo R-26 gestellt ist (`ruleApplies('R-26', graph)`), sonst „noch nicht gebunden (Entwurf)" |
| `src/projections/help-content.ts` | `HELP_ELEMENT_STATES`: realisiert / `external`; „noch nicht fällig" ist Zustand des Graphen |
| `src/surface/mcp-server.ts`, `src/kernel/harness-import.ts` | „Author a TEST + verify trace" |
| `src/surface/scaffold-docs.ts` | „An unbound TEST has no run artifact" |
| `src/projections/test-schlupf.ts` | Kommentar |
| `.claude/commands/` | `se-test`, `se-test-ui`, `se-fmea`, `se/top-level`, `se/close-violations`, `se/author-req`: keine Aussage nennt `concept` mehr als Attribut oder Ausweg. Kopien unter `.opencode/skills/` gibt es in diesem Repo nicht (nur `.opencode/plugin/`) |

`grep -rni concept src`: nur noch das englische Wort (SE concept, Test Concept, Concept of Operations).

### ICD-Zelle — warum mehr als Löschen

`tests/steering.artifact-coupling.test.ts` (T-B4, CR-GC-353) hält fest: „im Dokument markiert = am Gate offen". Ohne
`concept` und mit schweigendem R-26 hätte das ICD im Entwurf an jedem SCHEMA „⚠ kein realRef (R-26)" gedruckt, während
keine Regel den Befund hält. Die Zelle fragt deshalb dieselbe Tabelle wie die Regel (contracts `ruleApplies`) — keine
zweite Definition.

## Befund zur Exporter-Klippe

**Es gibt sie nicht.** Geprüft, weil mit CR-SM-392 jede `testRefs`/`realRef`-Bindung die Realisierung beginnt:

- `renderTestStubs` / `renderSchemaStubs` materialisieren die **Datei** einer **vorhandenen, gültigen** Bindung
  (`readTestRefs`/`readRealRef` → `bound`). Ein Element ohne Bindung bekommt nichts; der Export schreibt kein
  Attribut in den Graphen.
- Ein Entwurf hat keine Bindung → kein Stub → `realizationBegun` bleibt `false`. Wo ein Stub entsteht, hat die
  Realisierung per Definition schon begonnen.
- Die Materialisierung hängt damit bereits an derselben Bedingung; ein eigener `realizationBegun`-Schalter im Exporter
  wäre eine zweite Formulierung derselben Frage. Nicht eingebaut.
- Belegt: `tests/export.testref-materialize.test.ts` (e) — Export eines Entwurfs: `stubs: []`, kein `tests/`, kein
  `src/`, kein Knoten mit `testRefs`/`realRef`, `realizationBegun` vorher und nachher `false`, keine R-19/R-20/R-26;
  Positivkontrolle mit einer gesetzten Bindung.

Neu durch den Wegfall: ein Alt-Element, das `concept: true` **und** eine Bindung trägt, wird jetzt materialisiert
(vorher übersprungen). Im Selbstmodell nachgezählt: von den 28 `concept`-Elementen an TEST/FUNC/SCHEMA trägt eines
eine Bindung (`TEST-advisory-roundtrip-latency`), die Datei existiert — der nächste `graph_export` legt keinen Stub an.

## Tests und Fixtures

| Datei | Änderung |
|---|---|
| `export.testref-materialize` | `TEST-concept` → zwei Alt-Fälle: `concept` ohne Bindung (kein Stub, R-19 meldet), `concept` mit Bindung (Stub entsteht). Neu (e) Entwurf, s. o. |
| `export.realref-materialize` | `SCHEMA-concept` → Alt-Fälle ungebunden / gebunden; `external` mit Bindung bleibt ohne Stub; R-26 meldet genau die Ungebundenen |
| `mcp.tests-operational` | (f) „laufbar ODER Konzept" → „laufbar ODER von R-19 gemeldet" (am Selbstmodell); (g) jeder `unresolved`-Eintrag ist eine TEST ohne `testRefs`, Grund `no testRefs attribute` |
| `readiness.completeness` | Fall „`concept:true` liest TRR vollständig" entfernt (die Ausnahme gibt es nicht) |
| `steering.artifact-coupling` | neu: Entwurf → keine R-26 am Gate, keine Marke im ICD; nach erster Bindung beides |
| `auto-export`, `graph-timetravel`, `generate` | Attribut aus der Fixture entfernt (Entwurf bzw. gestempelt — der Fall hing nie daran) |
| `cli.scaffold` | `GRAPHCODE.md` nennt „unbound TEST" und **nicht** mehr `concept` |
| `codec.roundtrip`, `fixtures/steering-graphs.ts` | Kommentar |
| `exporter`, `mcp.merge`, `intent-anchors-internal` | geprüft — nur das englische Wort, unverändert |
| `fixtures/perf-basis.graph.json`, `fixtures/todo-local-v9.graph.json` | **nicht angefasst** — eingefrorene Alt-Graphen, dürfen `concept` tragen |

## Nicht Teil dieses CR

- Selbstmodell (`docs/graph/graphcode.graph.json`, `docs/views/*`): 28 Elemente mit `concept`, CR-Knoten — der
  Auftraggeber zieht sie über den Host nach.
- `CLAUDE.md` Z. 127 („A concept-only TEST has no run artifact") — Projektregeln, nicht vom Agenten geändert.
- `graph_generate {task: 'realisierung'}` liest im Entwurf „fertig" (s. CR-GC-743).

## Umfang laut `graph_impact`

Nicht gelaufen: der laufende Host war tabu. Umfang aus der Konsumentenliste von CR-SM-393 plus
`grep -rni concept src tests .claude .opencode`.

## Verifikation

- `npm run build` / `type-check` grün gegen die verlinkte Arbeitskopie (contracts 10.15.0).
- `npm run verify:full CR-GC-744` (2026-10-05): 202 Dateien, 1772 Tests grün, 2 rot — `tests/lockfile-sync.test.ts`
  und `tests/distribution.test.ts`, beide Link-Modus (10.15 nicht in der Registry), erwartet. Spur VOLL
  (`tests/fixtures/steering-graphs.ts` hat keinen Modellknoten), Schlupf 0, Folge 4/10 unverändert.
- Zwischenstand rot und behoben: die Größen-Riegel `tests/mcp.agent-agnostic.test.ts` (tools/list-Budget) und
  `tests/vorspann.test.ts` (`GRAPHCODE.md` < 6 000 Zeichen) — die Ersatztexte waren länger als „concept-only".
- CR von Hand angelegt (wie CR-GC-743): `aise dispatch prepare` hätte über den laufenden Host einen CR-Knoten
  geschrieben. `crRefs` im Item und der CR-Knoten fehlen — nachzuziehen.
