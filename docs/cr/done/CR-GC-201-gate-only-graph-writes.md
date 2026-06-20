# CR-GC-201: Enforce gate-only graph writes (agent cannot hand-edit the SSOT)

**Status:** Done (2026-06-20) · **Milestone:** `MS-3-mvp-readiness` · **Datum:** 2026-06-18 · **Max Files:** 5
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

## Implementation (landed 2026-06-20, branch `loop-test`)
Surfaced while debugging a live↔committed drift (Kuzu frozen at a 245-element snapshot while the JSON had been hand-edited up to 281). Root cause = exactly this CR not being enforced. Fixes:

1. **Deny-hook** — `.claude/settings.json` `PreToolUse` (matcher `Edit|Write|MultiEdit`) → `.claude/hooks/deny-graph-write.sh`: blocks any write to `docs/graph/*.graph.json` or `.graphcode/kuzu*` (exit 2 + redirect to `graph_mutate`). Verified against both SSOT paths and normal source/views.
2. **Lossless Kuzu SSOT (prerequisite, was broken).** Kuzu reload silently dropped `created_at`/`kinds`/**all edge attributes** (only declared columns persisted) — so "JSON = export(store)" was impossible. Added the `attrs_json` catch-all column on every node+rel table and adapter serialize/parse (`@sigloch/graph-cypher-wasm` v0.2.0). Round-trip now keeps 281 nodes + 593 edges + all attrs (arrays/timestamps included).
3. **Deterministic export** — `exportGraphJson` now sorts elements by uid and traces by (source,type,target), so `export(Kuzu-reload) === export(committed)` **byte-identical** regardless of Kuzu row order (REQ-deterministic-serialization R3). Committed JSON re-canonicalized (pure reorder, data identical).
4. **Drift warning** — `mcp-server.ts` warns (does not auto-reseed/clobber) when the seeded store differs from the committed JSON, so a stale store / pending export is visible instead of silently served (the failure mode that froze the store).

**Provenance proof:** `graph_export` from the live store reproduces the committed JSON byte-for-byte. Tests: graphcode 110/110, graph-cypher-wasm 27/27.

**Open follow-ups:** scaffold the deny-hook into target repos via `graphcode init/update` (FUNC-harness-cli); wire a literal CI provenance job (today enforced by `exporter.test.ts` + `export-graph.mjs` guard). Graph node `CR-GC-201` status flip + `TEST-no-direct-graph-write` wiring done via the gate in the spec pass.
