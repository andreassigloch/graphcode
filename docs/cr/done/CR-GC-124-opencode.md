# CR-GC-124: OpenCode-Execution: agent-agnostic 2nd client, headless BYOK

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** Die headless MCP-stdio-Bedienung (`serveStdio`, `graphcode mcp` bin) war bereits implementiert + agent-agnostisch by construction; es fehlte nur der Beweis. Neuer Test `tests/mcp.agent-agnostic.test.ts` (3 Cases): zwei unabhängige MCP-Clients (`agent-claude-code`, `agent-opencode`) gegen EINE Harness/EINEN Kuzu-Store — identische Tool-Sets + identische Gate-Semantik (gleicher tier, gleiche R-01-Blockade unter Delta-Semantik), Cross-Visibility beweist den geteilten Single-Writer-Gate. `FUNC-serve-stdio`/`REQ-agent-agnostic`/`TEST-agent-agnostic` → done. Kein neuer Produktivcode. 113/113 grün.
**Graph (SSOT):** realisiert `MOD-mcp-tools`, `REQ-agent-agnostic`, `REQ-single-transport`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
graphcode headless von OpenCode getrieben (BYOK), als zweiter MCP-stdio-Client neben Claude Code — beweist die agent-agnostische + headless Claim (verriegelt: OpenCode-executed).

## Spec-Knoten ergänzt (2026-06-19)
`FUNC-serve-stdio` (satisfy `REQ-agent-agnostic` + `REQ-single-transport`, allocate `MOD-mcp-tools`) — die headless MCP-stdio-Bedienung für den agent-agnostischen 2nd-Client. `REQ-agent-agnostic` draft→open + `TEST-agent-agnostic` (R-01 geschlossen).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-111
