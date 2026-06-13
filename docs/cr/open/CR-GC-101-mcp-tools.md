# CR-GC-101 — GraphCode MCP-Tools

**Status:** Open · **Modul:** `src/mcp-tools.ts` · **Prio:** 1a · **Stand:** 2026-06-13
**Dependency:** CR-GC-100 · **Spec:** `docs/SPEC.md` §2.2, §5 · bok governance §2.4

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

## Gate (Acceptance)

- [ ] Tool-invoke-Tests (MCP-stdio): `graph_mutate` läuft durchs selbe Gate wie `harness.mutate`.
- [ ] `graph_elements` read-only, keine Mutation.
- [ ] Violations-Dict identisch zwischen MCP-Pfad und in-process-Pfad (L2).

## Drift-Locks

L2 (MCP-Symmetrie: MCP `graph_mutate` == in-process `mutate()`, gleiche Semantik/Violations).
