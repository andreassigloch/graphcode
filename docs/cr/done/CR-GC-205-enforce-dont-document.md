# CR-GC-205: Enforce-don't-document — R-18 structural rule + executable guardrails + CLAUDE.md slim-down

**Status:** Done (2026-06-21) — **alle 5 Items**: R-18 (Item 1), Executable Guardrails (Item 2), CLAUDE.md slim-down (Item 3), R-19+testRef-Materialisierung (Item 4), R-20 FUNC-code-binding + codeRef-Backfill (Item 5) · **Milestone:** `MS-5-efficiency` · **Datum:** 2026-06-21 · **Max Files:** 5 (split per item)

## Realisiert 2026-06-21 (Items 2 + 3 + graphcode-Seite Item 5)

- **Item 2 — Executable Guardrails:** (a) NUL-/Binär-Source-Guard `.claude/hooks/deny-binary-source.sh` (PreToolUse, BSD-safe, getestet block/allow); (b) **Read-vor-Edit** = Harness-Built-in (Edit verlangt Read) → **kein** Zusatz-Hook (kein Parallelpfad); (c) Shared-Package-vor-Integration `scripts/ensure-siblings-built.sh` als `pretest` (staleness-guarded rebuild von contracts+graph-api-core dist → kein Stale-Dist-False-Green); (d) Tool/Skill-Counts aus der **Live-Registry/Dir** abgeleitet statt Magic-Number (`mcp.stdio-server` listTools == `bindToolsToHarness()`, `skills.mcp-conformance`/`cli.scaffold` aus dem Skill-Dir). **Wirkung sofort bewiesen:** der `pretest` fand die uncommittete Parallel-Session-Änderung (R-20) → readiness.model rot, bis R-20 integriert.
- **Item 3 — CLAUDE.md slim-down:** Projekt-`CLAUDE.md` „Erzwungen, nicht dokumentiert"-Sektion (jede erzwungene Invariante → ihr Enforcer: deny-graph-write/deny-binary-source-Hook, R-18/R-19/R-20, pretest, Built-in-Read-vor-Edit). Global `~/.claude/CLAUDE.md`: Read-vor-Edit als Harness-erzwungen markiert (konservativ — globale Regeln haben meist keinen globalen Enforcer; kein Gutting der persönlichen Guardrails).
- **Item 5 (DONE):** R-20 (FUNC-code-binding, warning) — contracts-Regel + `CodeRefSchema` + `FUNC.codeRef/external/concept` + `MOD.path` (Versions 3.6.0/2.3.0) `8b1a99d`; graphcode R-20→**CDR**-Partition `0d7f537`. **codeRef-Backfill über alle 36 FUNC-Knoten** durchs Gate: 25 code-realisiert (`codeRef {file, symbol}`, jedes Symbol real in `src/` verifiziert), 9 external (Skills/se-view-* + Cytoscape-Renderer = graph-view-edit), 2 concept (`mergeNodes`/`migrateSchema` un-implementiert). **R-20 feuert jetzt 0.** Die LSP-gestützte Symbol-/Cross-Module-Call-Konformanz bleibt bewusster Follow-up (Consumer-Check, kein R-20-Scope).
- Items 2/3 sind **Dev-Prozess** (Hooks/Config/Docs), nicht Produkt-REQs → bewusst **keine** Graph-Knoten (vs. Items 1+4, die Produkt-Invarianten sind). **150 Tests grün, tsc grün.**
**Graph (SSOT):** Items 1 + 4 sind im Graphen realisiert (über die Live-Gate, single-writer): `REQ-structural-rule-shared` + `TEST-structural-rule-shared` (→ `tests/harness.gate.test.ts`), `REQ-testref-materialized` + `TEST-testref-materialize` (→ `tests/export.testref-materialize.test.ts`), `CR-GC-205` Knoten, je verify/satisfy/compose-Trace, unter `MS-5-efficiency`. `R-18`/`R-19` sind V3_RULE-Wirkungen (kein eigener Graph-Knoten — Regeln leben in `@sigloch/contracts/se`). Items 2/3 (`FUNC-pre-commit-guards`, `REQ-claude-md-enforced` je +TEST) noch queued.

## Realisiert 2026-06-21 (Items 1 + 4)

- **Item 1 — R-18 `valid-trace-pattern` (error) in `@sigloch/contracts/se`** (`rules.ts` + `RULES_VERSION 2.1.0→2.2.0`): Trace-Pair-Legalität ist jetzt eine Engine-Regel (gegen `TRACE_PATTERNS`/`isValidTrace`). graphcodes Gate (`harness.mutate` Step 3b) **ruft `codec.validate()` nicht mehr** — Pair-Legalität = R-18 (Engine), referenzielle Integrität = R-08; nur ein **slim Unknown-Type-Guard** bleibt am Gate (Kuzu-DDL-Schutz). `codec.validate()`-Feld aus `harness` entfernt (kein Parallelpfad). **R-18 fand reale Drift:** 3 `MS -relation-> MS`-Kanten ohne `depends-on`-Label (auch unsichtbar für MS-02) → gelabelt.
- **Item 4 — R-19 `runnable TEST binding` (warning) + `concept`-Marker + Export-Materialisierung**: `R-19` (warning, wie R-05) macht einen ungebundenen lauffähigen TEST in `rules_evaluate`/`readiness` sichtbar; `concept:true` (neu in `ELEMENT_ATTRIBUTES.TEST`, `ONTOLOGY_VERSION 3.4.0→3.5.0`) nimmt Concept-only-TESTs aus. **`graph_export` materialisiert** einen `it.todo`-Stub für jede gebundene-aber-fehlende testRef-Datei (`exporter.renderTestStubs`) → graph_tests löst nie auf einen Phantom-Pfad auf (kein false-green), existierende Dateien werden nie überschrieben. Readiness-Partition: R-18→CDR, R-19→TRR.
- **Tests:** `harness.gate.test.ts` (d) prüft R-18-Gate-Block; `export.testref-materialize.test.ts` (neu, 3 Fälle) prüft Materialisierung; `readiness.model`/`bootstrap`/`readiness.ontology-sync` an die 2 neuen Regeln angepasst. **150 Tests grün, contracts + graphcode `tsc` grün.**

## Problem (Why) — eine Wurzel, mehrere MS-4-Vorfälle

Mehrere Vorfälle der MS-4-Implementierung gehen auf **dasselbe Muster** zurück: ein Invariant war **dokumentiert** (CLAUDE.md-Prosa) oder in einem **lokalen/zweiten** Validator erzwungen — nicht am *einen* autoritativen Punkt (Gate/Engine/Hook). Belege aus dieser Session:

1. **Partial-Persist-Drift trotz Doku.** Eine strukturell ungültige Mutation (`CR -relation-> TEST`) passierte das Gate, applizierte in-memory und warf erst im Kuzu-DDL mid-transaction → in-memory ≠ store, Recovery nötig — **obwohl** „keine parallelen Pfade" in CLAUDE.md steht. Grund: Trace-Pair-Validität war **nie eine Regel, die die Engine läuft** (`R-08` prüft nur referenzielle Integrität, nicht Pair-Validität); sie lag nur in graphcodes `codec.validate()`. CR-GC-200 hat sie nachträglich als **zweiten** Validator ans Gate geschraubt.
2. **Subagent-Korruption rutschte durch.** Ein Subagent schrieb 2 NUL-Bytes in eine `.ts` (nur per `git diff` „Bin" entdeckt); ein anderer fügte eine redundante `express`-Dep hinzu. „Output verifizieren" ist eine Gewohnheit, kein Check.
3. **Count/Version-Literale brachen wiederholt.** Jedes neue MCP-Tool brach 3 hardcodierte Count-Assertions, jeder Skill 2, der Ontology-Bump riskierte Versions-Literale — weil hardcodiert statt abgeleitet.
4. **CLAUDE.md ist groß und wird teils überflogen.** Die Regeln, die *hielten*, waren die **erzwungenen** (Gate, gate-only-write deny-hook, export-clobber-guard) — nicht die Prosa.

**These:** Die zuverlässigste Regel ist eine erzwungene, keine dokumentierte. Invarianten gehören in die **eine Engine / das Gate / einen Hook** — und die Prosa, die sie beschrieb, wird gelöscht.

## Decision — 4 Sub-Items (je eigener ≤5-Datei-Sub-CR)

### Item 1 — `R-18: valid-trace-pattern` als first-class Regel in `@sigloch/contracts/se` (höchste Hebelwirkung; cross-repo, Familie-Review L1/L2)
Trace-Pair-Validität von graphcodes lokalem `codec.validate()` (+ Kuzu-DDL) in die **V3_RULES** heben: neue Regel `R-18` (error), evaluiert gegen `TRACE_PATTERNS` (genau die `validPairs`, die `SE_DESCRIPTOR.edgeTypes[...].validPairs` schon hält). Dann erzwingt der *eine* `engine.evaluate()`, den das Gate ohnehin läuft, **semantisch UND strukturell** — und **jeder** Konsument, der die Engine läuft (nicht nur graphcodes Gate), bekommt es gratis.
- `contracts/src/se/rules.ts`: `R-18` + Registrierung; `index.ts`: `RULES_VERSION` minor-bump. Familie-Review + Consumer-Rebuild (graph-api-core, graphcode, claude-plugin).
- graphcode `harness.mutate()`: die separate `codec.validate()`-Gate-Prüfung (CR-GC-200 Step 5) **entfernen** für Pair-Validität — R-18 deckt sie jetzt via Engine ab (Delta-Semantik bleibt identisch). `codec.validate()` bleibt Export-/Parse-Backstop für Dup-UID + referenzielle Integrität (oder diese ebenfalls als Regeln heben — prüfen).
- **Akzeptanz:** `CR -relation-> TEST` ist eine **R-18-Engine-Violation** (in `rules_evaluate`/`graph_readiness` sichtbar) und wird vom Delta-Gate atomar abgelehnt — **ohne** `codec.validate()`-Aufruf im Gate. Kein Parallelpfad (eine Regelbasis, ein Enforcement). CR-GC-200 entsprechend nacharbeiten/vermerken.

### Item 2 — Executable Guardrails (graphcode `.claude/settings.json` Hooks) — „verify" von Gewohnheit zu Check
- **Korruptions-Klasse:** Pre-commit / PreToolUse-Hook lehnt jede gestagte Source-Datei ab, die `file` als nicht-Text/`data` meldet (NUL-Byte-Fall). Hätte die graph-cypher-wasm-NUL-Bytes automatisch gefangen.
- **Read-before-Edit:** PreToolUse-Hook auf Edit/Write, der ohne vorheriges Read blockt (Harness trackt den Read-State).
- **Shared-Package-Edit:** Hook/CI-Schritt, der bei einer sigloch-modules-Paket-Änderung die **eigene** Test-Suite des Pakets vor Integration läuft.
- **Count/Version aus der Quelle ableiten:** die hardcodierten `toBe(N)`-Tool-/Skill-Counts (`mcp.agent-agnostic`, `mcp.stdio-server`, `skills.mcp-conformance`, `cli.scaffold`) gegen die **live** `bindToolsToHarness()`-Registry / importierte Konstanten asserten statt Magic-Number. Siehe Memory `graphcode-test-count-coupling`.

### Item 4 — `R-19: runnable-TEST-binding` + `concept`-Marker + Export-Materialisierung (DONE 2026-06-21; testRef-Trust aus CR-204-Folgearbeit)
Das CR-204-Vertrauensloch („graph_tests kann auf einen Phantom-Pfad auflösen / ein lauffähiger TEST ohne Bindung") aus der einmaligen Konformanz-Test-Prüfung in **Engine + Export** heben:
- `contracts/src/se`: `R-19` (**warning**, wie R-05 — Vollständigkeits-Signal, kein Hard-Gate; ein frisch-spezifizierter TEST ist legitim concept-level bis implementiert) — non-concept TEST ohne valide `testRef` → sichtbar in `rules_evaluate`/`readiness`. `concept`-Marker (boolean) neu in `ELEMENT_ATTRIBUTES.TEST`. `RULES_VERSION 2.2.0`, `ONTOLOGY_VERSION 3.5.0`.
- graphcode `graph_export` (`exporter.renderTestStubs`): materialisiert einen `it.todo`-Stub für jede gebundene-aber-fehlende `testRef`-Datei — **die** harte Garantie gegen Phantom-Pfade (kein false-green), existierende Dateien nie überschrieben, concept-only übersprungen. Dateiexistenz ist Filesystem-I/O → gehört in den Export, **nicht** in die (pure) Engine-Regel.
- **Akzeptanz:** ungebundener lauffähiger TEST = R-19-Warning sichtbar; `graph_export` scaffoldt fehlende Stubs; graph_tests löst danach auf reale Dateien auf. Readiness-Partition: R-19→TRR.

### Item 3 — CLAUDE.md slim-down — pro Regel fragen „erzwingbar?"; wenn ja → Hook/Test/Gate, Prosa **löschen**
Aus CLAUDE.md (global + projekt) die jetzt erzwungenen Regeln retiren: strukturelle Validität (Gate/R-18), gate-only-writes (deny-hook, done), Read-vor-Edit + Test-after-Edit (→ Hooks aus Item 2). Behalten nur das **nicht-Erzwingbare** (Kommunikationsstil, strategische Prioritäten, „bei Unklarheit fragen"). Ziel: CLAUDE.md schrumpft; was bleibt, ist genau das, was kein Check sein kann. **Mess-Heuristik:** eine Regel, die trotz Niederschrift verletzt wurde (z.B. der Partial-Persist trotz „keine parallelen Pfade"), ist Top-Kandidat fürs Erzwingen.

## Akzeptanz (gesamt)
- **Item 1 (DONE):** `R-18` gemerged + RULES-bump + Consumer grün; Gate lehnt strukturell-invalide Mutation via Engine ab (ohne separaten codec-Aufruf); CR-200-Doppelung aufgelöst.
- Item 2: Hooks aktiv + ein NUL-Byte-/Edit-without-Read-Fall wird real geblockt; Count-Assertions abgeleitet (kein `toBe(N)` mehr).
- Item 3: CLAUDE.md(s) kürzer; jede gelöschte Regel hat einen erzwingenden Gegenpart (Gate/Hook/Test) verlinkt.
- **Item 4 (DONE):** `R-19` (warning) + `concept`-Marker gemerged (ONTOLOGY+RULES-bump); `graph_export` materialisiert fehlende testRef-Stubs (`it.todo`), graph_tests phantomfrei; Readiness-Partition R-18→CDR / R-19→TRR.

## Drive-by (nicht Kern, optional in Item-2-Geist)
`moneyflow/package.json`: `@sigloch/contracts: file:../../sigloch-modules/...` → `file:../sigloch-modules/...` (eine Ebene zu tief → broken symlink, kein dist, `/finance` unauflösbar). **Pre-existing**, beim MS-4-Rollout-Verify aufgetaucht — nicht von MS-4 verursacht. Evidenz fürs Item-2-Thema: auch file:-Dep-Pfade gehören gelintet, nicht angenommen.

## Dependencies
CR-GC-200 (Gate strukturell, done — wird von Item 1 abgelöst/nachgearbeitet) · CR-GC-201 (gate-only-writes deny-hook, done) · CR-GC-134/204 (testRef/graph_tests — der test-after-edit-Hook in Item 2 kann `graph_tests` für selektive Läufe nutzen, sobald operativ).
