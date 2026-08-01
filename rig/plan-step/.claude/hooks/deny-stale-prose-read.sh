#!/bin/bash
# CR-GC-214 — PreToolUse deny-hook: block Read of self-declared INPUT-ONLY / stale prose.
#
# REQ-graph-first-read: the graph is SSOT. A doc that declares itself superseded
# (e.g. SPEC.md after the model moved into the graph) must not be ingested as a
# planning input — the agent must query graph_context / graph_elements instead.
# Read-side twin of deny-graph-write.sh (CR-GC-201). "enforce, don't document."
#
# The file declares ITSELF stale via a head marker (no hardcoded path list — no
# second drift source; couples to CR-GC-207's SPEC.md INPUT-ONLY header).
# Escape: GRAPHCODE_ALLOW_STALE_READ=1 allows the read (migration/audit/codec-diff).
# Protocol: PreToolUse JSON on stdin; exit 2 BLOCKS + stderr to the agent; else exit 0.

[ "${GRAPHCODE_ALLOW_STALE_READ:-}" = "1" ] && exit 0

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

# Self-declared marker in the file head (first 15 lines).
if head -n 15 "$file" 2>/dev/null | grep -Eiq 'status:[[:space:]]*INPUT-ONLY|SUPERSEDED-BY-GRAPH'; then
  echo "BLOCKED (CR-GC-214): '$file' declares itself INPUT-ONLY — the graph is SSOT, not this doc." >&2
  echo "Query the model instead: graph_context <node> (definition-of-done), graph_elements {type}, graph_readiness." >&2
  echo "Override deliberately with GRAPHCODE_ALLOW_STALE_READ=1 (migration/audit only)." >&2
  exit 2
fi
exit 0
