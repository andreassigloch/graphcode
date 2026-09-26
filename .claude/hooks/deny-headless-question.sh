#!/bin/bash
# CR-GC-690 — PreToolUse deny-hook: no AskUserQuestion in a headless run.
#
# GRAPHCODE.md ("When the brief leaves something open", CR-GC-592) says an open decision goes
# into the model as an assumption; a question is asked only when a human can answer it. In a
# headless run (`claude -p`) nobody does: the harness answers the call with an error and the
# turn is lost. Measured in the rig: 5 of 18 `opus5` runs called it anyway. Prose did not hold
# the rule — this hook does. "enforce, don't document."
#
# Headless = `claude -p`, which Claude Code marks with CLAUDE_CODE_ENTRYPOINT=sdk-cli
# (interactive: cli, VS Code: claude-vscode, Agent SDK: sdk-ts/sdk-py — those have a human
# or a host answering, so they pass). Registered with matcher AskUserQuestion.
# Protocol: PreToolUse JSON on stdin; exit 2 BLOCKS + stderr to the agent; else exit 0.

[ "${CLAUDE_CODE_ENTRYPOINT:-}" = "sdk-cli" ] || exit 0

cat >/dev/null
echo "BLOCKED (CR-GC-690): this is a headless run (claude -p) — nobody will answer the question." >&2
echo "Put the open point into the model as an assumption (assumption review, a REQ with an open" >&2
echo "target value, or an ACTOR with an open channel), name it in your closing message, and continue." >&2
exit 2
