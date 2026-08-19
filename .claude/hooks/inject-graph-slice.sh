#!/bin/bash
# CR-GC-367 — UserPromptSubmit hook: push the JOB SLICE into the agent's context.
#
# Why push and not a tool the agent may call: measured (SPIKE-GC-minimal-whitebox, Arm C)
# the agent called graph_context/graph_impact/graph_expand 4 times across 400+ tool calls
# with all three on offer. A slice the agent is expected to fetch does not get fetched.
#
# Why the anchor comes from the prompt and not from a grep pattern: a uid is an EXACT token
# ("implementiere CR-GC-366"), so this is a set lookup against the graph's uid space, never a
# similarity search over node names — that would be the prose-grep the graph exists to replace.
# No uid in the prompt, or an unknown one => silent no-op. NEVER a fuzzy fallback.
#
# Why over the HTTP bridge: exactly one process owns the Kuzu store (REQ-single-kuzu-owner).
# The hook must never open a second handle, so it asks the elected host, which computes the
# slice with the same buildJobSlice the tool layer uses (no second definition of "slice").
#
# Protocol: UserPromptSubmit JSON on stdin ({prompt, …}); stdout is added to the agent's
# context; exit 0 ALWAYS. Blocking is reserved for the deny-hooks — a missing slice degrades
# the context, a blocked prompt breaks the session.
set -uo pipefail

[ "${GRAPHCODE_HOOK_INJECT:-0}" = "1" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null) || exit 0
[ -n "$prompt" ] || exit 0

# The read-only bridge is opt-in: `graphcode mcp` starts it ONLY when GRAPHCODE_HOST_PORT is
# set (src/mcp-server.ts maybeStartBridge), on exactly that port. No port => no bridge => no
# injection. That is the intended degradation, not a failure.
port="${GRAPHCODE_HOST_PORT:-}"
[ -n "$port" ] || exit 0
bridge="${GRAPHCODE_BRIDGE:-http://127.0.0.1:$port}"

# uid-shaped tokens only: <TYPE>-<name>, TYPE uppercase. Deliberately narrow — a token that
# is not a uid must not reach the graph at all.
anchors=$(printf '%s' "$prompt" | grep -oE '\b[A-Z][A-Z0-9]*-[A-Za-z0-9._-]+' | sort -u | head -4)
[ -n "$anchors" ] || exit 0

emitted=0
for anchor in $anchors; do
  body=$(curl -sf -m 3 "$bridge/context/$anchor" 2>/dev/null) || continue   # unknown uid / bridge down
  count=$(printf '%s' "$body" | jq -r '.nodeCount // 0' 2>/dev/null)
  [ "${count:-0}" -gt 0 ] 2>/dev/null || continue
  if [ "$emitted" -eq 0 ]; then
    printf 'Graph-Scheibe zu diesem Auftrag (aus dem governten Modell, nicht aus Prosa).\n'
    printf 'Sie ist der Arbeitsumfang, nicht die Leseschranke — weitere Graph-Abfragen sind erwuenscht.\n'
    emitted=1
  fi
  seeds=$(printf '%s' "$body" | jq -r '(.seeds // []) | join(", ")' 2>/dev/null)
  missing=$(printf '%s' "$body" | jq -r '(.missingRefs // []) | join(", ")' 2>/dev/null)
  printf '\n## %s — %s Knoten, %s Kanten\n' "$anchor" "$count" "$(printf '%s' "$body" | jq -r '.edgeCount // 0')"
  [ -n "$seeds" ] && printf 'Arbeitsknoten: %s\n' "$seeds"
  [ -n "$missing" ] && printf 'Ohne Realisierungs-Referenz (noch zu implementieren): %s\n' "$missing"
  printf '\n%s\n' "$(printf '%s' "$body" | jq -r '.formatE // empty')"
done
exit 0
