# CR-GC-127: graph_export MCP tool — close the agent loop over MCP

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-18 · **Closed:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** exposes the re-export sync path (`FUNC-export-markdown` / `REQ-doc-export`, beide bereits done) über die MCP-Surface; neuer `TEST-mcp-export`. Siehe `docs/graph/graphcode.graph.json`.

## Problem / Scope
Beim Live-Durchlauf von MVP-1 (`graphcode init` → spec → impact → implement → re-export) fehlte der letzte Schritt **über die Agent-Surface**: `bindToolsToHarness` hatte kein `graph_export`. Der Re-Exporter (CR-GC-113) war nur als Library-Funktion / als Skript erreichbar, das in einem separaten Prozess aus dem **verlustbehafteten** Kuzu-Store lädt — der Agent konnte seine Session über MCP nicht abschließen. Der einzige Prozess mit dem voll-fidelen In-Memory-Graphen ist der laufende MCP-Server; daher gehört das Export-Trigger dorthin.

## Lösung
- `graph_export` MCP-Tool (`src/mcp-tools.ts`): serialisiert den **live** `harness.getGraph()` via `exportGraphJson`/`exportMarkdown` (CR-113) und schreibt `docs/graph/<name>.graph.json` + `docs/views/*.md` unter den Repo-Root. Default-Name = `scope.systemId`; `views` optional. Gibt geschriebene Pfade + Byte-Größen zurück. Registry: 10 → 11 Tools.
- `src/harness.ts`: `getRepoRoot()` + `getScope()` Getter (das Tool braucht das Schreibziel).
- `tests/mcp.export.test.ts`: Disk-Kuzu, spec durchs Gate → `graph_export` → JSON + Views auf Platte, Round-Trip, GENERATED-Header. `tests/mcp.stdio-server.test.ts`: Tool-Liste auf 11 erweitert.

## Akzeptanz
`npm run build` + `npm test` grün (83). Live-E2E über realen CLI+MCP-stdio-Server durchlaufen: init → gate-mutate (bootstrap+spec) → graph_impact (4/7, KNOW) → implement → graph_export (JSON+4 Views geschrieben). `TEST-mcp-export` → done.

## Dependencies
CR-111 (MCP-Server), CR-113 (Exporter)
