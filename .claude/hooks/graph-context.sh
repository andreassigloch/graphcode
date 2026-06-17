#!/bin/bash
AIMPROVE_API="${AIMPROVE_API:-http://localhost:3001}"
if ! curl -s --max-time 1 "$AIMPROVE_API/api/health" > /dev/null 2>&1; then
  exit 0
fi
VIOLATIONS=$(curl -s --max-time 3 "$AIMPROVE_API/api/graph/violations" 2>/dev/null | jq -r '.[]? | select(.severity == "error" or .severity == "warning") | "[\(.severity)] \(.rule_id): \(.message)"' 2>/dev/null)
if [ -n "$VIOLATIONS" ]; then
  echo "[Graph-Spec] Violations:" >&2
  echo "$VIOLATIONS" >&2
fi
