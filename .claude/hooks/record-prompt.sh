#!/bin/bash
# CR-GC-356 — UserPromptSubmit hook: capture the human prompt VERBATIM for the audit trail.
#
# The MCP path is the one path where the harness cannot see the prompt: Claude Code / OpenCode
# never send it to a tool. So the client hands it over here, out of band, and `recordAudit`
# stamps it (graph-api-core `AuditEntry.intent`, CR-GC-354).
#
# Why not a tool parameter the agent fills: what a model writes about its own prompt is a
# PARAPHRASE — it already contains the interpretation a later consumer would want to predict —
# and `consumerId` shows what self-declared fields are worth (40% anonymous default on the real
# trail). This hook is the client's own verbatim copy, untouched by the model.
#
# Why at all, when Claude Code keeps a transcript: `~/.claude/projects` is a rolling ~30-day
# window (default cleanupPeriodDays) and exists for one client. Measured 2026-08-15: 18% of this
# repo's audit records are already older than ANY surviving transcript.
#
# One file per session, overwritten on every prompt — the trail is the archive, this is a relay.
# Each relay names the CLIENT PROCESS it belongs to (CR-GC-357) so the recording side can match
# exactly instead of guessing. Guessing was not a hypothetical: measured 2026-08-16, this machine
# ran five live client processes with four relays written inside 24 minutes — no time window
# separates those, so the old "exactly one relay" rule meant "never record" in normal use.
# Protocol: UserPromptSubmit JSON on stdin ({session_id, prompt, cwd, …}); exit 0 always. This
# hook must NEVER block a prompt: failing to record provenance is a gap in the data, while
# refusing the user's turn would be a defect. Absent output reads as "not recorded" (CR-GC-354).

set -u
root="${CLAUDE_PROJECT_DIR:-$PWD}"
dir="$root/.graphcode/prompts"

input=$(cat) || exit 0
command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -z "$session" ] && exit 0
# Path-safety: a session id is an opaque token from the client, never a path fragment.
case "$session" in *[!A-Za-z0-9._-]*) exit 0 ;; esac

mkdir -p "$dir" 2>/dev/null || exit 0

# Stale relays are noise AND ambiguity: the reader deliberately records nothing when several
# sessions look active (a wrong prompt→result pairing would poison exactly the data being
# collected). Pruning yesterday's files is what keeps the single-session case unambiguous.
# Prune by LIVENESS, not by age (CR-GC-357): a relay whose client process is gone can never be
# matched again, and leaving it lay is what made the directory look ambiguous. `kill -0` is the
# exact test; the old `-mtime +0` kept every session of the day around for nothing.
for f in "$dir"/*.json; do
  [ -e "$f" ] || continue
  owner=$(jq -r '.ownerPid // empty' "$f" 2>/dev/null)
  if [ -z "$owner" ] || ! kill -0 "$owner" 2>/dev/null; then rm -f "$f"; fi
done

# The owning client process: walk up to the first ancestor whose EXECUTABLE is named `claude`.
# Matched on the basename, never on the command line — this script's own path contains
# `.claude/hooks/`, so a command-line match would find our own shell.
# GRAPHCODE_OWNER_PID overrides the walk (tests only — Claude Code never sets it). Same escape
# shape as GRAPHCODE_ALLOW_STALE_READ in the deny hooks: one field, one override, no second path.
owner="${GRAPHCODE_OWNER_PID:-}"
pid=$PPID
[ -n "$owner" ] && pid=1
for _ in 1 2 3 4 5 6 7 8; do
  [ -z "$pid" ] && break
  [ "$pid" = "1" ] && break
  comm=$(ps -o comm= -p "$pid" 2>/dev/null)
  [ -z "$comm" ] && break
  if [ "${comm##*/}" = "claude" ]; then owner="$pid"; break; fi
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
# No ancestry, no key — write nothing rather than a relay that can only be matched by guessing.
[ -z "$owner" ] && exit 0

printf '%s' "$input" \
  | jq -c --arg owner "$owner" '{sessionId: .session_id, prompt: .prompt, ownerPid: $owner, ts: (now | todate)}' \
  > "$dir/$session.json.tmp" 2>/dev/null || exit 0
# Atomic swap: recordAudit may read this concurrently and must never see a half-written file.
mv -f "$dir/$session.json.tmp" "$dir/$session.json" 2>/dev/null || rm -f "$dir/$session.json.tmp"
exit 0
