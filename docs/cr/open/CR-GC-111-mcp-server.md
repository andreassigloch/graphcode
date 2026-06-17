# CR-GC-111: MCP-stdio-Server + bin (graphcode mcp)

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-3-mvp-readiness`, `MOD-cli`, `REQ-mcp-tool-registry`, `REQ-mcp-gate-symmetry`, `REQ-single-transport`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
bindToolsToHarness an StdioServer binden (gate-symmetrisch, L2); .mcp.json + .claude/hooks/*.sh vom toten localhost:3001 auf den In-Process-Server umstellen.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
M2 (Harness/Tools)
