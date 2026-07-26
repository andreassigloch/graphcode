#!/bin/bash
# CR-GC-205 Item 2 — PreToolUse guard: reject a Write/Edit that would put a NUL
# (0x00) byte into a file. A NUL means binary corruption (e.g. a subagent that
# mangled a .ts), which `git diff` only flags as "Bin" and which silently breaks
# tsc. "Verify your output" is a habit; this makes it an enforced check.
#
# Protocol: Claude Code passes the PreToolUse JSON on stdin; exit 2 BLOCKS the
# tool and feeds stderr back to the agent. Any other path exits 0 (allow).
#
# NUL handling: the stdin JSON escapes a content NUL as a unicode escape (so the
# captured `input` holds no literal NUL — bash vars silently drop NULs). `jq -r`
# unescapes it back to a real NUL; that stream is piped DIRECTLY into `tr` (never
# captured into a var, which would strip it). `tr -cd` keeps only NULs; `wc -c`
# counts them. BSD-safe (no grep -P, which macOS lacks).

input=$(cat)

nul_count=$(printf '%s' "$input" | jq -r '
  [ .tool_input.content,
    .tool_input.new_string,
    ( .tool_input.edits // [] | .[].new_string )
  ] | map(select(. != null)) | join("\n")' 2>/dev/null \
  | LC_ALL=C tr -cd '\000' | wc -c | tr -d ' ')

if [ "${nul_count:-0}" -gt 0 ]; then
  file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // "the target file"' 2>/dev/null)
  echo "BLOCKED (CR-GC-205): refusing to write a NUL (0x00) byte into '$file' — that is binary corruption, not source text." >&2
  echo "Re-generate the content cleanly (a stray NUL means the file would break tsc and only show as 'Bin' in git diff)." >&2
  exit 2
fi
exit 0
