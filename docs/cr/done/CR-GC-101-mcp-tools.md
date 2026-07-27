# CR-GC-101: MCP-Tools — Graph statt grep (Ziel a)

**Status:** Done (2026-06-17) · **Modul:** `src/mcp-tools.ts` (Graph: `MOD-mcp-tools`)
**Refs:** ADR-001 §4 AD-4 (Query-Precision), §3 (MCP-stdio) · bok `graphcode-governance.md` §2.4
**Graph:** `CR-GC-101 -relation→ MOD-mcp-tools` (+ REQs unten) · **Dependency:** CR-GC-100 · **Max Files:** 5

## Problem (Why)
Der Agent soll den **governten Graphen statt grep** nutzen (Ziel a): präziser Blast-Radius statt Volltext-Dump —
das ist der Token-/LLM-Effizienz-Hebel (`UC-token-efficiency`, `UC-reduced-llm`). Ohne MCP-Surface bleibt der
Graph für Claude Code unerreichbar; ohne Gate-Symmetrie (L2) entstünde ein zweiter Schreibpfad.

## Entscheidung
MCP-stdio-Registry, an die Harness gebunden (`bindToolsToHarness`); **kein direkter Kuzu-Zugriff im Tool**.
`graph_mutate` == in-process `mutate()` (identische Violations, L2). Query-Precision-Tools liefern Format-E-Slices.

## Scope (realisiert vorhandene Graph-Knoten)
FUNC: `FUNC-graph-impact`, `FUNC-graph-expand` (→ `MOD-mcp-tools`); Registry-Tools read/`graph_mutate`/rules/audit.
REQ: `REQ-mcp-tool-registry`, `REQ-mcp-gate-symmetry`, `REQ-query-precision`, `REQ-subgraph-slicing`,
`REQ-progressive-expansion`, `REQ-cache-layering`, `REQ-audit-trail`, `REQ-single-transport`.

## Akzeptanzkriterien (Graph: TEST-Knoten)
`TEST-mcp-symmetry` grün (MCP-Pfad == in-process, identisches Violations-Dict) ·
`TEST-impact-subgraph` grün (`graph_impact` nur betroffener Subgraph, kein Full-Dump) · `graph_elements` read-only.

## Dependencies
CR-GC-100 (Harness/Gate).
