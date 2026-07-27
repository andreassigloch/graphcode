# CR-GC-131: adopt view skills A (arch/nfr/trade) to MCP

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (skills completion) · **Datum:** 2026-06-18 · **Max Files:** 3
**Graph (SSOT):** realizes `MOD-skills` (functional) for `FUNC-render-views` on these views. Pointer — derive acceptance from the graph.

## Problem (Why)
`.claude/skills/se-view-arch.md`, `se-view-nfr.md`, `se-view-trade.md` `curl ${GRAPH_API}/api/graph/query?view=X` against the retired endpoint.

## Scope (3 skills)
Rewrite each to: fetch the relevant slice via the MCP query tools (`graph_elements` with type filters / `graph_get_edges` / `graph_impact`) and RENDER the view in the agent's response — skills are prompts, the agent is the renderer (no server-side view endpoint; this is the KNOW-via-query design). No curl, no `${GRAPH_API}`. If a Mermaid diagram is rendered, avoid `()` and `|` in node labels (blanks the whole diagram — see [[mermaid-label-special-chars]]).

## Acceptance
The 3 view skills reference only MCP tools (0 `localhost:3001`/`GRAPH_API`/`/api/graph`); `npm run build` + `npm test` green.

## Dependencies
CR-GC-111 (MCP), CR-GC-126 (query tools)
