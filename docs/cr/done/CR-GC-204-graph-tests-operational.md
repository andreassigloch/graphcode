# CR-GC-204: graph_tests operational — testRef backfill + code→REQ→TEST traversal

**Status:** Done · **Milestone:** `MS-5-efficiency` · **Datum:** 2026-06-21 · **Max Files:** 5
**Abschluss:** 2026-06-21 — `harness.testImpact()` (gerichteter code→REQ→TEST-BFS über das eine
`getSubgraph`-Primitiv) + `graph_tests` Code-Changeset-Modus; testRef-Backfill über alle 35 lauffähigen
TEST-Knoten (14 concept-only explizit `testRef:null`+`concept:true`), neuer `TEST-codec-validation`-Knoten;
`changeSet=[MOD-codec,MOD-harness]` löst `graph-integrity`+`codec.validation`+`harness.gate` auf (kein
false-green), `TEST-graph-tests-operational` verriegelt Coverage + Deduktion. **147 Tests grün, Build grün.**
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-5-efficiency`, `REQ-graph-tests-operational`, `FUNC-resolve-tests-from-code`, `TEST-graph-tests-operational`; touches `MOD-mcp-tools`. Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem (Why)

`graph_tests` (CR-GC-134) ist gebaut, aber auf dem realen Graphen **noch nicht vertrauenswürdig** — empirisch gemessen am 2026-06-21 gegen den live SSOT-Graphen:

1. **Falsche Richtung für Code-Changesets.** `graph_tests` wrappt `graph_impact`, das **eingehende Dependents** liefert. Von einem Code-Knoten (MOD/FUNC) sind die TESTs nicht erreichbar — die Kette ist `TEST -verify-> REQ <-satisfy- FUNC -allocate-> MOD`, die die Richtung **zweimal dreht**. Gemessen:
   - `changeSet=[MOD-codec, MOD-harness]` (die in CR-GC-200 geänderten Dateien) → **64 impacted nodes, 0 davon TEST** → `vitest run --passWithNoTests`. Ein Code-Changeset selektiert **nichts**.
2. **testRef-Coverage zu dünn + ungenau.** Nur **7 von 47** TEST-Knoten tragen `testRef`. Selbst mit dem *korrekten* REQ-Changeset:
   - `changeSet=[REQ-graph-integrity, REQ-export-no-clobber]` → impactedTests 3, resolved 2 → `vitest run tests/graph-integrity.test.ts tests/mcp.export-guard.test.ts` — **verfehlt `tests/codec.validation.test.ts` und `tests/harness.gate.test.ts`**, wo die neuen Tests tatsächlich liegen (TEST-graph-integrity.testRef zeigt auf *eine* Datei; die Änderung erstreckt sich über drei).

**Folge:** „Den Graphen nach den relevanten Tests fragen" hätte 2 Dateien gelaufen und die 2 geänderten übersprungen — ein falsches Grün. Solange das nicht behoben ist, ist die volle Suite die ehrliche Absicherung — d.h. der R12/R13-Effizienzgewinn (selektive statt voller Lauf) ist **nicht realisiert**.

Hinweis: Das ist **kein Defekt von CR-GC-134** — dessen Akzeptanz (REQ-Changeset + testRef'te TESTs → selektives Kommando) ist erfüllt und grün. CR-134 hat den testRef-Backfill explizit als Folgearbeit vermerkt. Dieser CR macht `graph_tests` operativ.

## Decision

Zwei Hebel, ein operatives `graph_tests`:

1. **testRef-Backfill (Daten, über das Gate).** Jeden lauffähigen TEST-Knoten mit `testRef {file, case?, tool, level}` versehen (heute 7/47). Mapping TEST-Knoten → echte vitest-Datei/-Case. Concept-only TESTs (noch kein Run-Artefakt) **explizit** als solche markieren (z.B. `attributes.testRef: null` + `concept:true`), damit `graph_tests` sie ehrlich unter `unresolved` listet statt sie still zu verlieren. Quelle der Wahrheit: die `describe`/`it`-Namen der `tests/*.test.ts` + die `verify`-Traces.
2. **Gerichtete code→REQ→TEST-Auflösung in `graph_tests` (`FUNC-resolve-tests-from-code`).** `graph_tests` muss ein **Code-Changeset** (MOD/FUNC/git-diff→Knoten) akzeptieren und gerichtet `geänderter Knoten →satisfy/allocate→ REQ →verify→ TEST` laufen — nicht nur reines incoming-`graph_impact`. Optionen (im neuen Chat entscheiden, **kein Parallelpfad** zu `graph_impact`):
   - (a) `harness.impact()` um einen Richtungs-/Pfad-Parameter erweitern (down-then-up), oder
   - (b) in `graph_tests` einen expliziten `code→REQ→TEST`-Resolver ergänzen, der die `satisfy`/`allocate`/`verify`-Traces direkt traversiert.
   Die REQ-Changeset-Pfad (heute funktionierend) bleibt erhalten; der Code-Changeset-Pfad kommt dazu.

## Akzeptanz

- `graph_tests({changeSet:['MOD-codec','MOD-harness']})` liefert die **TESTs, die diese Module verifizieren** (nicht 0), aufgelöst über testRef auf die korrekten Dateien — inkl. `codec.validation` + `harness.gate`.
- `testRef`-Coverage = **alle lauffähigen TEST-Knoten** (concept-only explizit ausgenommen + als `unresolved` gelistet); ein Konformanz-Test (`TEST-graph-tests-operational`) verriegelt das.
- Ein Code-Change → `graph_tests` → selektives `vitest run <nur-betroffene-Dateien>`, das **jede** vom Change berührte Testdatei enthält (kein false-green) und unbeteiligte ausschließt.
- `git-diff → Knoten`-Helfer (Dateipfad → MOD/FUNC) dokumentiert oder implementiert.
- `npm run build` + `npm test` grün; `graph_tests` wrappt weiterhin **einen** Impact-/Traversal-Pfad (kein zweiter Blast-Radius).

## Realisierung (Reihenfolge, ≤5 Dateien)

1. `src/mcp-tools.ts` (+ ggf. `src/harness.ts`) — `graph_tests` Code-Changeset-Modus + gerichtete Auflösung.
2. testRef-Backfill als **Gate-Batch** (`graph_mutate` update-node) über die 47 TEST-Knoten — kein File-Edit, läuft durch das (jetzt strukturell validierende) Gate; danach `graph_export`.
3. `tests/mcp.tests-deduction.test.ts` erweitern: Code-Changeset → korrekte, vollständige Dateiliste; + `TEST-graph-tests-operational` (testRef-Coverage-Konformanz).

## Dependencies

CR-GC-134 (graph_tests + testRef-Schema, done) · CR-GC-200 (Gate strukturell validierend — testRef-Backfill-Batch läuft durchs Gate, done) · baut auf `FUNC-graph-impact` (done).
