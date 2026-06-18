# CR-GC-201: Enforce gate-only graph writes (agent cannot hand-edit the SSOT)

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` · **Datum:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** realizes `+REQ-gate-only-writes` (constraint, refines `REQ-one-gate-per-repo`) + `+TEST-no-direct-graph-write`; touches `.claude/` config + `MOD-docs`. *(graph nodes queued for the graph-owner chat.)*

## Problem (Why)
Claude Code (and this session's scripts) can `Read`/`Edit` `docs/graph/graphcode.graph.json` directly, bypassing the `mutate()` gate. That is the root cause of: the CR-119 collision, the near-clobber by `seed-graph.mjs`, the duplicated validation (CR-GC-200), and future N-writer JSON merge conflicts. "Every edit through one gate (L1)" is violated the moment an agent edits the file by hand.

**Answer to "how do we assure the agent uses MCP/Kuzu, not the JSON file?":** make the gate the *only* write path, and make direct file-writes impossible.

## Decision
1. **The JSON is a generated EXPORT, not a source.** The live truth is the Kuzu store; the committed `graphcode.graph.json` is re-exported deterministically by the host (CR-GC-113). Hand-editing it is pointless (next export overwrites) and detectable.
2. **Deny direct writes at the harness level.** `.claude/settings.json` deny rule on `Edit`/`Write` to `docs/graph/graphcode.graph.json` (and `.graphcode/kuzu/**`), plus a `PreToolUse` hook that blocks the write and tells the agent to use the `graph_mutate` MCP tool. The agent then *cannot* bypass the gate — it must go through MCP → `mutate()` → Kuzu.
3. **CI provenance check:** committed JSON must equal `export(store)` (no smuggled hand-edits); pairs with CR-GC-200's integrity test.
4. **Reads:** prefer the MCP query tools (`graph_impact`/`graph_elements` — KNOW not guess); raw-file reads are harmless but discouraged. Enforcement is on **writes**.

## Timing
Lands WITH **CR-GC-111** (the MCP `graph_mutate` write path) and **CR-GC-113** (the exporter). The deny rule must NOT precede them, or all graph edits are blocked with no alternative.

## Akzeptanz
A direct `Edit`/`Write` to the SSOT is denied by the harness; `graph_mutate` (MCP) succeeds and is gate-validated; CI rejects a hand-edited (non-export) JSON.

## Dependencies
CR-GC-111 (MCP server / `graph_mutate`), CR-GC-113 (Kuzu→JSON exporter).
