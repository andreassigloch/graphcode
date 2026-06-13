# CR-GC-101 — GraphCode MCP-Tools

**Status:** Open · **Modul:** `src/mcp-tools.ts` · **Prio:** 1a · **Stand:** 2026-06-13
**Dependency:** CR-GC-100 · **Spec:** `docs/SPEC.md` §2.2, §5 · bok governance §2.4
**Requirements:** R6 (graph_query = anti-grep) · R7 (Sub-Graph-Slicing) · R8 (Cache-Layering) · R12 (Query-Precision/Impact) · R13 (progressive Expansion) — `docs/RECOMMENDATIONS.md`

## Ziel

MCP-Tool-Registry + Bindung an die Harness-Instanz, über **MCP-stdio** (Claude-Code-native).
Kanal 1 der Host-Topologie (SPEC §5): der Agent nutzt den Graphen statt grep (Ziel a).

## Tasks

- **Registry** (SPEC §2.2): `graph_elements` / `graph_get_node` / `graph_get_edges` (read),
  `graph_mutate` (write, durchs Gate), `rules_evaluate` / `rules_get_violations`,
  `audit_trail` / `audit_stats`.
- **`bindToolsToHarness(harness)`** — jedes Tool ruft `harness.mutate/loadGraph/evaluateRules`.
  Kein direkter Kuzu-Zugriff im Tool.
- **MCP-stdio-Transport** verdrahten (kein HTTP/REST im Harness-Core — L2 MCP-Symmetrie).
- **Query-Precision-Tools (R6/R12/R13 · Ziel a):** `graph_impact(elementId, depth?)` → exakt der
  Blast-Radius (Caller/Traces/Tests) als **Format-E**; `graph_expand(handle, branch, depth+1)` →
  progressive On-Demand-Vertiefung (Kuzu-Re-Traversierung, **kein** Originals-Store);
  `pruneToFit(maxTokens)`-Budget (R7). **Query-Precision statt Result-Kompression.**

## Gate (Acceptance)

- [ ] Tool-invoke-Tests (MCP-stdio): `graph_mutate` läuft durchs selbe Gate wie `harness.mutate`.
- [ ] `graph_elements` read-only, keine Mutation.
- [ ] Violations-Dict identisch zwischen MCP-Pfad und in-process-Pfad (L2).
- [ ] `graph_impact` liefert nur den betroffenen Subgraphen (kein Full-Dump); `graph_expand` vertieft on-demand.

## Drift-Locks

L2 (MCP-Symmetrie: MCP `graph_mutate` == in-process `mutate()`, gleiche Semantik/Violations).
