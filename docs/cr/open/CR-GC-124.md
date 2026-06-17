# CR-GC-124: OpenCode-Execution: agent-agnostic 2nd client, headless BYOK

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `MOD-mcp-tools`, `REQ-agent-agnostic`, `REQ-single-transport`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
graphcode headless von OpenCode getrieben (BYOK), als zweiter MCP-stdio-Client neben Claude Code — beweist die agent-agnostische + headless Claim (verriegelt: OpenCode-executed).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-111
