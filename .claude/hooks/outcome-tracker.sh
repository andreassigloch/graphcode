#!/bin/bash
AIMPROVE_API="${AIMPROVE_API:-http://localhost:3001}"
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0
if ! curl -s --max-time 1 "$AIMPROVE_API/api/health" > /dev/null 2>&1; then
  exit 0
fi
curl -s --max-time 2 -X POST "$AIMPROVE_API/api/hooks/outcomes" \
  -H "Content-Type: application/json" \
  -d "{\"file\": $(echo "$FILE_PATH" | jq -Rs .), \"tool\": \"$TOOL\"}" \
  > /dev/null 2>&1 &
