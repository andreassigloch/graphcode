# CR-GC-205: Enforce-don't-document — R-18 structural rule + executable guardrails + CLAUDE.md slim-down

**Status:** Draft · **Milestone:** `MS-5-efficiency` · **Datum:** 2026-06-21 · **Max Files:** 5 (split per item)
**Graph (SSOT):** **Knoten queued für den graph-owner chat** (single-writer — NICHT aus zwei Chats schreiben). Zu realisieren: `R-18` als V3_RULE-Knoten-Wirkung (kein eigener Graph-Knoten — Regeln leben in `@sigloch/contracts/se`), `REQ-structural-rule-shared`, `FUNC-pre-commit-guards`, `REQ-claude-md-enforced`, je `+TEST`; touches `MOD-harness`, `MOD-codec`, `MOD-mcp-tools`. Diese Datei ist Draft-Pointer.

## Problem (Why) — eine Wurzel, mehrere MS-4-Vorfälle

Mehrere Vorfälle der MS-4-Implementierung gehen auf **dasselbe Muster** zurück: ein Invariant war **dokumentiert** (CLAUDE.md-Prosa) oder in einem **lokalen/zweiten** Validator erzwungen — nicht am *einen* autoritativen Punkt (Gate/Engine/Hook). Belege aus dieser Session:

1. **Partial-Persist-Drift trotz Doku.** Eine strukturell ungültige Mutation (`CR -relation-> TEST`) passierte das Gate, applizierte in-memory und warf erst im Kuzu-DDL mid-transaction → in-memory ≠ store, Recovery nötig — **obwohl** „keine parallelen Pfade" in CLAUDE.md steht. Grund: Trace-Pair-Validität war **nie eine Regel, die die Engine läuft** (`R-08` prüft nur referenzielle Integrität, nicht Pair-Validität); sie lag nur in graphcodes `codec.validate()`. CR-GC-200 hat sie nachträglich als **zweiten** Validator ans Gate geschraubt.
2. **Subagent-Korruption rutschte durch.** Ein Subagent schrieb 2 NUL-Bytes in eine `.ts` (nur per `git diff` „Bin" entdeckt); ein anderer fügte eine redundante `express`-Dep hinzu. „Output verifizieren" ist eine Gewohnheit, kein Check.
3. **Count/Version-Literale brachen wiederholt.** Jedes neue MCP-Tool brach 3 hardcodierte Count-Assertions, jeder Skill 2, der Ontology-Bump riskierte Versions-Literale — weil hardcodiert statt abgeleitet.
4. **CLAUDE.md ist groß und wird teils überflogen.** Die Regeln, die *hielten*, waren die **erzwungenen** (Gate, gate-only-write deny-hook, export-clobber-guard) — nicht die Prosa.

**These:** Die zuverlässigste Regel ist eine erzwungene, keine dokumentierte. Invarianten gehören in die **eine Engine / das Gate / einen Hook** — und die Prosa, die sie beschrieb, wird gelöscht.

## Decision — 3 Sub-Items (je eigener ≤5-Datei-Sub-CR)

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

### Item 3 — CLAUDE.md slim-down — pro Regel fragen „erzwingbar?"; wenn ja → Hook/Test/Gate, Prosa **löschen**
Aus CLAUDE.md (global + projekt) die jetzt erzwungenen Regeln retiren: strukturelle Validität (Gate/R-18), gate-only-writes (deny-hook, done), Read-vor-Edit + Test-after-Edit (→ Hooks aus Item 2). Behalten nur das **nicht-Erzwingbare** (Kommunikationsstil, strategische Prioritäten, „bei Unklarheit fragen"). Ziel: CLAUDE.md schrumpft; was bleibt, ist genau das, was kein Check sein kann. **Mess-Heuristik:** eine Regel, die trotz Niederschrift verletzt wurde (z.B. der Partial-Persist trotz „keine parallelen Pfade"), ist Top-Kandidat fürs Erzwingen.

## Akzeptanz (gesamt)
- Item 1: `R-18` gemerged + RULES-bump + Consumer grün; Gate lehnt strukturell-invalide Mutation via Engine ab (ohne separaten codec-Aufruf); CR-200-Doppelung aufgelöst.
- Item 2: Hooks aktiv + ein NUL-Byte-/Edit-without-Read-Fall wird real geblockt; Count-Assertions abgeleitet (kein `toBe(N)` mehr).
- Item 3: CLAUDE.md(s) kürzer; jede gelöschte Regel hat einen erzwingenden Gegenpart (Gate/Hook/Test) verlinkt.

## Drive-by (nicht Kern, optional in Item-2-Geist)
`moneyflow/package.json`: `@sigloch/contracts: file:../../sigloch-modules/...` → `file:../sigloch-modules/...` (eine Ebene zu tief → broken symlink, kein dist, `/finance` unauflösbar). **Pre-existing**, beim MS-4-Rollout-Verify aufgetaucht — nicht von MS-4 verursacht. Evidenz fürs Item-2-Thema: auch file:-Dep-Pfade gehören gelintet, nicht angenommen.

## Dependencies
CR-GC-200 (Gate strukturell, done — wird von Item 1 abgelöst/nachgearbeitet) · CR-GC-201 (gate-only-writes deny-hook, done) · CR-GC-134/204 (testRef/graph_tests — der test-after-edit-Hook in Item 2 kann `graph_tests` für selektive Läufe nutzen, sobald operativ).
