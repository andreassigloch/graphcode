# CR-GC-130: adopt the action skills (fmea/review/status) to MCP

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (skills completion) · **Datum:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** realizes `MOD-skills` (functional, prompt-realized) for the action skills. Pointer — derive acceptance from the graph (`MOD-skills`, the prompt-realized FUNCs).

## Problem (Why)
`.claude/skills/se-fmea.md`, `se-review.md`, `se-status.md` still `curl ${GRAPH_API:-http://localhost:3001}/api/...` — a DEAD endpoint retired in CR-GC-111. Without migration the MVP's SE workflows don't run.

## Scope (3 skills + ≤2)
Rewrite the 3 action skills to drive the graph through MCP tools (no curl, no `${GRAPH_API}`):
- query/structure → `graph_elements` / `graph_get_node` / `graph_get_edges` / `graph_impact` / `graph_expand`
- apply (was Format-E POST) → `graph_mutate` with `MutateCommand[]` — the gate returns `{success,tier,violations,appliedCommands}` and BLOCKS new error-violations (replaces the old "silently drops invalid" caveat)
- violations → `rules_get_violations` · readiness/scoring → `graph_readiness` (CR-GC-129)
Align stale ontology terms (se-fmea uses SY/UC/FC/FN/MD/RQ/RPN) with the LIVE ontology from `@sigloch/contracts/se` (SYS/UC/FUNC/REQ/TEST/MOD; compose/satisfy/verify/allocate) — import, NEVER fork. Update `GRAPHCODE.md` if it cites the old API.

## Acceptance
The 3 skills reference only MCP tools (0 `localhost:3001`/`GRAPH_API`/`/api/graph`); `npm run build` + `npm test` green. (Full-skill conformance test lands in CR-GC-132.)

## Dependencies
CR-GC-129 (graph_readiness), CR-GC-111 (MCP), CR-GC-126 (graph_impact)
