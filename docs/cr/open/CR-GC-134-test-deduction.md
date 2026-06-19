# CR-GC-134: Bottom-up Test-Deduktion (graph_tests)

**Status:** Open · **Milestone:** `MS-4-mvp2` · **Datum:** 2026-06-19 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `UC-efficient-testing`, `FUNC-deduce-tests`, `REQ-test-runnable-binding`, `TEST-test-runnable-binding`. Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
`graph_impact` liefert bereits die betroffenen TEST-Knoten eines Change, aber niemand übersetzt das in ein **lauffähiges, selektives Testset**. Der Nutzen (Zeit/Token sparen, Qualität: kein impacted Test wird übersehen) landet erst, wenn eine Änderung `vitest run <nur-betroffene-Dateien>` statt der vollen Suite erzeugt — die „richtigen Tests bottom-up für jede Änderung".

`graph_tests(changeSet)` mappt eine Änderung (geänderte Knoten-IDs oder git-diff→Knoten) via `graph_impact` auf die impacted TEST-Knoten, löst jeden über `testRef` zu seinem Run-Artefakt auf und emittiert das minimale selektive Run-Kommando + Coverage. **Kapselt `graph_impact` — kein Parallelpfad.**

## Architektur-Entscheidung
- **Familie-weit (Andreas, 2026-06-19):** `testRef` (Datei+Case, tool, level) wird Teil des **TEST-Element-Schemas in `@sigloch/contracts/se`** — nicht graphcode-lokal. Das Feature braucht die ganze Familie. **Minor-Version-Bump** (Ergänzung), Familie-Review + Consumer-Rebuild (Drift-Lock L1/L2).
- Tool-Surface: neues `graph_tests` in `MOD-mcp-tools`, **wrappt** `graph_impact` (kein zweiter Impact-Pfad).

## Keine Interferenz mit dem Testplan
- `testmatrix` = **Coverage** (ist jede REQ verifiziert?) — statisch, Vollständigkeit.
- `intplan` (Integrations-/Testplan) = **Plan** (welche MS verifiziert, Reihenfolge) — statisch, Meilenstein-Ebene.
- `graph_tests` = **Selektion** (was für *diese* Änderung laufen lassen) — dynamisch, Change-Ebene.

Gleiche `TEST→verify→REQ`-Traces als Input, verschiedene Fragen. `graph_tests` ist das Laufzeit-Gegenstück zu `intplan` und konsumiert die Coverage von `testmatrix`. Der `testRef` stärkt zugleich `testmatrix`/`intplan` (heute kennen sie nur *dass* Coverage existiert, nicht *wo* sie läuft).

## Realisierung (Reihenfolge)
1. `@sigloch/contracts/se` (`ontology.ts`): `testRef` optionales Attribut am TEST-Element + Version-Bump in `index.ts`; `npx tsc`. Familie-Review.
2. graphcode: `graph_tests` MCP-Tool (`mcp-tools.ts`) — Change → `graph_impact` → impacted TESTs → `testRef`-Resolver → selektives `vitest run`-Kommando.
3. `TEST-test-runnable-binding` (`tests/`): impacted TEST löst eindeutig auf; Run-Kommando enthält nur betroffene Tests.

## Akzeptanz
`FUNC-deduce-tests`/`REQ-test-runnable-binding` realisiert (→ `done`); `TEST-test-runnable-binding` + `TEST-efficient-testing` grün; `npm run build` + `npm test` grün; contracts-Bump gemerged + Consumer gebaut.

## Dependencies
`@sigloch/contracts` testRef-Bump (Familie-Review) · baut auf `FUNC-graph-impact` (done)
