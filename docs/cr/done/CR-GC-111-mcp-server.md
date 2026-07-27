# CR-GC-111: MCP-stdio-Server + bin (graphcode mcp)

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Closed:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-3-mvp-readiness`, `MOD-cli`, `REQ-mcp-tool-registry`, `REQ-mcp-gate-symmetry`, `REQ-single-transport`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Ergebnis (2026-06-18)
- `src/mcp-server.ts`: `bindRegistryToMcpServer` / `buildMcpServer(harness)` / `serveStdio({repoRoot})` — bindet die `bindToolsToHarness`-Registry an `@modelcontextprotocol/sdk` `McpServer` über `StdioServerTransport` (REQ-single-transport, kein HTTP).
- `src/cli.ts` + `bin: graphcode`: `graphcode mcp` bootet den In-Process-Server (agent-agnostisch: Claude Code & OpenCode). stdout bleibt dem JSON-RPC-Transport vorbehalten.
- `.mcp.json` auf `node dist/cli.js mcp` umgestellt; toter `localhost:3001`-Pfad (`.claude/mcp-graph-server.js` + `.claude/hooks/*.sh`) gelöscht.
- Graph: neuer `TEST-mcp-stdio-server` (verify → die 3 REQs); `REQ-mcp-tool-registry`/`-gate-symmetry`/`-single-transport` = `done`.
- Tests: `tests/mcp.stdio-server.test.ts` (linked transport + Disk-Kuzu, kein Mock) — 47/47 grün; realer Subprozess-stdio-Handshake verifiziert.
- **Offen (Folge-CR):** SE-Skills (`.claude/skills/se-*.md`) nutzen weiterhin `curl localhost:3001` — Migration auf MCP-Tools ist out-of-scope (separater CR). `.mcp.json` zeigt auf `dist/cli.js`; CR-GC-121 stellt auf `npx` für Fremd-Repos um.

## Problem / Scope
bindToolsToHarness an StdioServer binden (gate-symmetrisch, L2); .mcp.json + .claude/hooks/*.sh vom toten localhost:3001 auf den In-Process-Server umstellen.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
M2 (Harness/Tools)
