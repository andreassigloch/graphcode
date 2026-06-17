#!/bin/bash
AIMPROVE_API="${AIMPROVE_API:-http://localhost:3001}"
INPUT=$(cat)
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty' 2>/dev/null)
[ -z "$CONTENT" ] && exit 0
FORMAT_E=$(echo "$CONTENT" | perl -0777 -ne 'while (/```format-e\s*\n(.*?)```/sg) { print "$1\n" }' 2>/dev/null)
[ -z "$FORMAT_E" ] && exit 0
if ! curl -s --max-time 1 "$AIMPROVE_API/api/health" > /dev/null 2>&1; then
  exit 0
fi
RESULT=$(curl -s --max-time 5 -X POST "$AIMPROVE_API/api/graph/apply" \
  -H "Content-Type: application/json" \
  -d "{\"formatE\": $(echo "$FORMAT_E" | jq -Rs .)}" 2>/dev/null)
[ $? -ne 0 ] || [ -z "$RESULT" ] && exit 0
APPLIED=$(echo "$RESULT" | jq -r '.applied // 0' 2>/dev/null)
REJECTED=$(echo "$RESULT" | jq -r '.rejected // 0' 2>/dev/null)
[ "$APPLIED" -gt 0 ] 2>/dev/null || [ "$REJECTED" -gt 0 ] 2>/dev/null && echo "[Graph-Spec] Applied: $APPLIED, Rejected: $REJECTED" >&2
