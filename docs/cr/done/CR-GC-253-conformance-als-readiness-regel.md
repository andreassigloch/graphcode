# CR-GC-253: Graph↔Code-Konformanz als Readiness-Regel (RC-01/RC-02)

**Status:** done (2026-07-13) · **Max Files:** 6 (contracts + graphcode)
**Commits:** sigloch-modules f03ece4 (contracts RC-Regeln) · graphcode a52a894 (Extraktor + Verdrahtung)
**Abschlussnotizen:** testRef.case matcht per Substring (vitest -t-Semantik) — Exact-Match schlug
auf 2 reale Bindings an. Der Check fand beim ersten Lauf 3 echte Drifts im graphcode-SSOT
(FUNC-check-code-conformance nach Refactor re-realisiert, 2 case-Bindings via Substring gelöst).
`typescript` ist jetzt Runtime-Dependency (Konformanz parst Code bei jedem Readiness-Call);
Distribution-Test-Pin entsprechend erweitert.
**Kontext:** Befund aus graph-view-edit (Session 2026-07-13, Frage „ist der Graph stale?").
`checkCodeConformance` (CR-GC-206, `src/conformance.ts`) löst FUNC-codeRefs gegen den echten
Source-Tree auf — ist aber TEST/CLI-only. Weder `rules_evaluate` noch `graph_readiness` noch das
Dashboard sehen das Ergebnis.

## Problem (Why)

Der Implementierer kann Symbole umbenennen/löschen, der Graph zeigt weiter grün: R-20/R-19 prüfen
nur *Präsenz* des Bindings, nicht ob es auf etwas Reales zeigt. Drift wird erst im Retro oder durch
einen Bug sichtbar; `graph_tests`/`graph_impact` rechnen auf veralteten Bindings.

## Decision

1. **Regeln bleiben in der Regel-Bibliothek** (`@sigloch/contracts` `se/rules.ts`) — keine
   Regel-Definition in graphcode (Session-Entscheid 2026-07-13: eine Bibliothek pro Onto-Set,
   kein Verstreuen über Executor-Codebasen). Neue IDs **RC-01 (codeRef löst auf)** und
   **RC-02 (testRef löst auf)**, Severity error. Präfix RC- (Conformance), da RD- bereits für
   Decomposition-Regeln (RD-01..03) vergeben ist.
2. **Dependency Inversion statt fs in contracts:** RC-Regeln sind pure Funktionen
   `evaluate(graph, facts)` über einem neuen Datenvertrag **`CodeFacts`** (contracts, Zod):
   `{ fileExists, declaredSymbolsByFile, testCasesByFile }` — serialisierbar, ohne Dateisystem
   testbar. contracts bleibt I/O-frei und browser-bundlebar; ohne Facts (Browser) werden
   RC-Regeln als „not evaluated" ausgewiesen, nie still übersprungen.
3. **graphcode = Facts-Provider + Executor:** `src/conformance.ts` wird vom Regel-Träger zum
   Extraktor — `extractCodeFacts(graph, repoRoot)` (TS-Parser, `declaredSymbols` bleibt);
   `graph_readiness` reicht die Facts in die Regel-Auswertung, Violations landen als RC-01/RC-02
   in `violationsByRule` + Gate-Blockern (gleiche Partition wie R-20/R-19). Kein neues MCP-Tool.
4. **testRef-Prüfung (RC-02):** `testRef.file` existiert; wenn `case` gesetzt, muss der Name als
   String-Argument eines `it`/`test`/`describe`-CallExpression im File vorkommen (Parser-Fakt
   `testCasesByFile`, kein Substring-Match).
5. **Ausnahmen wie R-20:** `concept:true`/`external:true` übersprungen; Eltern-FUNC ohne eigenen
   codeRef mit gebundenen compose-Kindern (Semantik CR-GC-244) ⇒ keine RC-01-Violation — die
   bestehende „no valid codeRef"-Violation in conformance.ts entfällt (Doppelmeldung zu R-20,
   widerspricht 244).
6. **Parser bleibt TypeScript** (ts.createSourceFile deckt js/mjs/jsx via ScriptKind ab —
   Test pinnt .mjs/.jsx). Multi-Language: CR-GC-254 tauscht nur den Facts-Extraktor.

## Akzeptanz

- [x] Contracts-Test (ohne fs, CodeFacts-Fixture): codeRef auf gelöschtes Symbol ⇒ RC-01;
      testRef auf fehlende Datei bzw. nicht existierenden `case` ⇒ RC-02 (13 Tests).
- [x] Eltern-FUNC (concept:false, keine codeRef, Kinder gebunden) ⇒ keine RC-01-Violation.
- [x] graphcode: `graph_readiness` auf Repo mit gebrochenem codeRef ⇒ RC-01 in
      `violationsByRule`, CDR-Gate blockt; .mjs-/.jsx-codeRefs + vitest-case lösen auf (gve-Realität).
- [x] Ohne CodeFacts kein stiller Pass — gelöst durch Wegfall des Falls: es gibt keinen
      Produkt-Konsumenten des unangereicherten `scoreReadiness` mehr (nur Tests); alle
      Readiness-Oberflächen (graph_readiness, graph_help) laufen über `scoreReadinessWithConformance`.
- [x] `lang:'prompt'` weiterhin file-exists-only; concept/external weiterhin skipped.
