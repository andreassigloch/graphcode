# CR-GC-206: Graph↔code conformance — resolve FUNC codeRef symbols

**Status:** Done (2026-06-21) · **Milestone:** `MS-5-efficiency` · **Max Files:** 5
**Graph (SSOT):** realisiert `REQ-graph-code-conformance`, `FUNC-check-code-conformance` (→ `src/conformance.ts`), `TEST-code-conformance` (→ `tests/conformance.test.ts`), `CR-GC-206`; unter `MS-5-efficiency`. Pointer, nicht autoritativ.

## Problem (Why)

CR-205 Item 5 hat `codeRef {file, symbol}` auf alle realisierten FUNC-Knoten gebackfillt, aber nur **substring-geprüft** (Symbol-String kommt in der Datei vor). Das fängt keinen umbenannten/verschobenen Code: ein `codeRef` kann auf ein **nicht (mehr) existierendes** Symbol zeigen und der Substring-Check übersieht es. R-20 (contracts) prüft bewusst nur **Präsenz** (FUNC hat einen codeRef) — Regeln sind pur, kein I/O. Die **Auflösung** ist Consumer-Sache.

## Decision

Consumer-seitiger Konformanz-Check, der jeden `codeRef` über den **TypeScript-Parser** (LSP-grade, `ts.createSourceFile`) gegen den realen src-Baum auflöst:

- `src/conformance.ts` · `checkCodeConformance(graph, repoRoot)`: sammelt je Datei die deklarierten Symbole (Functions, Classes, Methods, const, Properties, Interfaces, Types, Enums, Accessors) und prüft, dass `codeRef.symbol` darunter ist. `lang:'prompt'` → Skill-Datei existiert. `concept`/`external` → übersprungen. Pur (nur FS-Reads), liefert `{checkedFuncs, resolved, promptResolved, skipped, violations}`.
- TEST/CLI-only-Modul (importiert `typescript`, devDep) — **nicht** aus den Runtime-Entry-Points erreichbar, bleibt aus dem published Bundle.
- `tests/conformance.test.ts`: seedet den committeten SSOT, läuft den Check gegen den realen src-Baum → **0 Violations**; ein bewusst falsches Symbol wird gefangen (nicht vacuous).

## Akzeptanz

- Jeder Code-`codeRef` löst auf ein **deklariertes** Symbol auf (TS-Parser, kein Substring); jeder Prompt-`codeRef` auf eine existierende Skill-Datei. Auf dem committeten Graphen: **0 Violations**.
- Der Check ist real: ein nicht-deklariertes Symbol wird als Violation gemeldet.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

Cross-Module-Call-Coverage — dass **jedes** über eine Modulgrenze aufgerufene Symbol selbst ein FUNC-Knoten ist (graph↔code-Vollständigkeit in der anderen Richtung). Braucht einen vollen Call-Graph; dieser CR löst die existierenden Bindungen auf. Kandidat für eine optionale MCP-Tool-Verdrahtung von `checkCodeConformance` (das Modul ist bereit), bewusst nicht im Runtime-Bundle.

## Dependencies

CR-GC-205 Item 5 (R-20 + codeRef-Backfill, done) · `@sigloch/contracts/se` `CodeRefSchema`.
