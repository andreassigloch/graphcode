#!/bin/bash
# CR-GC-201 — PreToolUse deny-hook: block direct writes to the governed graph SSOT.
#
# REQ-gate-only-writes / REQ-graph-is-ssot: the live truth is the Kuzu store; the
# committed docs/graph/*.graph.json is a GENERATED export (graph_export). Every
# model edit — human or agent — must go through the apply-gate (graph_mutate MCP
# tool → harness.mutate(), L1). A hand Edit/Write bypasses the gate, the rule
# evaluation, and the deterministic export → drift. This hook makes that
# impossible.
#
# Protocol: Claude Code passes the PreToolUse JSON on stdin; exit 2 BLOCKS the
# tool and feeds stderr back to the agent. Any other path exits 0 (allow).

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0

case "$file" in
  *docs/graph/*.graph.json | *.graphcode/kuzu*)
    echo "BLOCKED (CR-GC-201): '$file' is the governed graph SSOT — a direct Edit/Write bypasses the apply-gate." >&2
    echo "Change the model via the graph_mutate MCP tool (→ mutate(), L1)." >&2
    echo "The committed JSON is a generated export — re-export with graph_export, never hand-edit." >&2
    exit 2
    ;;
esac
exit 0
