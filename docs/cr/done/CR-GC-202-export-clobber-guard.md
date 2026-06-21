# CR-GC-202: graph_export refuse-to-clobber guard

**Status:** Done (2026-06-21) · **Milestone:** `MS-3-mvp-readiness` (safety net) · **Datum:** 2026-06-18 · **Max Files:** 3

> **Close-Befund (2026-06-21):** Bereits funktional implementiert + getestet — der Empty-Guard + Net-Deletion-Guard in MCP `graph_export` (`src/mcp-tools.ts`) **feuerte mehrfach live in dieser Session** (z.B. „graph_export refused: would delete TEST-harness-install … force:true" bei intentionalen Deletes). `tests/mcp.export-guard.test.ts` (3 Cases: empty→refuse, would-drop→refuse+untouched, force→overwrite) grün; `tests/mcp.export.test.ts` (fresh export) grün. Nur Modell-Status nachgezogen: `REQ-export-no-clobber`/`TEST-mcp-export-guard` → done (+ testRef). Kein Code-Change.
**Graph (SSOT):** realizes `+REQ-export-no-clobber` (constraint, refines `REQ-graph-is-ssot`) + `+TEST-mcp-export-guard`; touches `MOD-mcp-tools`. *(graph nodes queued for the graph-owner chat — single-writer discipline; do not add from two chats.)*

## Problem (Why)
The MCP `graph_export` (CR-GC-127) did a blind `writeFileSync` over `docs/graph/<name>.graph.json`. A long-running MCP server — or a **parallel ist-vs-soll sync** — can hold a graph that is BEHIND the committed SSOT (`initialize()` reloads from Kuzu; `seedFromJson` only runs when Kuzu is empty). Exporting then **silently DROPS** committed elements/traces.

**Observed live (2026-06-18):** the running server's in-memory graph was 234 nodes / 483 traces while the committed JSON was 235 / 484 (CR-GC-133 `TEST-scaffold-skills`, commit 551e2bc). A `graph_export` deleted CR-133 from the SSOT; only the git-clean check caught it. This is the N-writer hazard behind CR-GC-201, and the asymmetry with `scripts/export-graph.mjs` — which *already* refuses to clobber (round-trip + empty guards) while the MCP tool did not.

## Decision
Mirror the script's guards in the MCP tool (`src/mcp-tools.ts` `graph_export`):
1. **Empty guard** — refuse if the live graph has 0 elements (never overwrite a populated SSOT with nothing).
2. **Net-deletion guard** — before writing, read the committed file; if the write would drop any element id or trace (`source>type>target`) present on disk but missing from the live graph, **abort** and name the dropped ids.
3. **`force:true` override** — explicit opt-in for intentional deletions; default `false` keeps every export safe.

No new write path, no rule-engine change — pure pre-write check. The deeper fix (live server drifting from the committed SSOT) stays with CR-GC-201; this is the safety net that makes the drift loud instead of silent.

## Akzeptanz
`npm run build` + `npm test` green. `tests/mcp.export-guard.test.ts`: (a) empty graph → refuse, (b) would-drop-committed-element → refuse + file untouched, (c) `force:true` → overwrites. Existing `tests/mcp.export.test.ts` still green (fresh-file export unaffected).

## Dependencies
CR-GC-127 (graph_export, done). Reinforces CR-GC-201 (gate-only writes), sibling of CR-GC-200.
