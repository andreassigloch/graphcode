# CR-GC-129: graph_readiness MCP tool — expose readiness over the agent surface

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (skills completion) · **Datum:** 2026-06-18 · **Max Files:** 4
**Graph (SSOT):** touches `MOD-mcp-tools`; exposes `scoreReadiness` (CR-GC-107, `MOD-readiness`) over MCP. Realizes the MCP-reachability of family readiness. Pointer — derive acceptance from the graph.

## Problem (Why)
The SE skills `se-review` / `se-status` need a readiness score, which the retired `localhost:3001` API served at `GET /api/graph/readiness`. The harness has `scoreReadiness(harness)` (exported from `src/index.ts`) but it is NOT reachable via MCP — so an agent over the MCP surface cannot get readiness. Prerequisite for CR-GC-130.

## Scope (≤4 files)
- `src/mcp-tools.ts`: add `graph_readiness` to `bindToolsToHarness` — calls `scoreReadiness(harness)`, returns the `ReadinessReport` (compliance score, violationsByRule, dimensions). Mirror the CR-GC-127 `graph_export` pattern. Registry 11 → 12 tools.
- `tests/mcp.readiness.test.ts`: real disk Kuzu, seed a small graph through the gate, assert the report shape + that family rule-IDs (R-/RD-), not BQ-, drive it.
- `tests/mcp.stdio-server.test.ts`: update the enumerated tool list to 12 (add `graph_readiness`).
- `docs/graph/graphcode.graph.json`: mark realized node(s) + add `TEST-mcp-readiness` (verify edge).

## Acceptance
`npm run build` + `npm test` green; `graph_readiness` listed over the protocol; realized graph nodes → done.

## Dependencies
CR-GC-107 (scoreReadiness), CR-GC-111 (MCP server), CR-GC-127 (tool-binding pattern)
