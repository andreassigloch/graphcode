# CR-GC-132: adopt view skills B (testmatrix/testconcept/implplan) + skills conformance

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (skills completion) · **Datum:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** realizes `MOD-skills` (functional) for the remaining views + adds `TEST-skills-mcp`; marks `MOD-skills` done. Pointer — derive acceptance from the graph.

## Problem (Why)
`.claude/skills/se-view-testmatrix.md`, `se-view-testconcept.md`, `se-view-implplan.md` still `curl` the retired endpoint — the last skills on the dead path.

## Scope (3 skills + test + graph)
- Rewrite the 3 remaining view skills like CR-GC-131 (fetch via MCP query tools, agent renders).
- `tests/skills.mcp-conformance.test.ts` (`TEST-skills-mcp`): grep ALL `.claude/skills/*.md` → **0** matches for `localhost:3001|GRAPH_API|/api/graph|/api/dashboard`, and each skill references ≥1 MCP tool name. This is "done = verified" for the prompt-realized FUNCs (runs green only once 130/131/132 are all merged).
- `docs/graph/graphcode.graph.json`: add `TEST-skills-mcp` (verify → MOD-skills / the FUNCs); mark `MOD-skills` (and the prompt-realized FUNCs) done.

## Acceptance
All 9 SE skills MCP-driven (conformance test green); `npm run build` + `npm test` green; `MOD-skills` + realized nodes → done. Consider closing CR-GC-104 (MOD-skills modeling) once functional.

## Dependencies
CR-GC-130, CR-GC-131 (the other skills migrated first)
