#!/bin/bash
# GraphCode Harness Uninstaller — counterpart to aimprove-init.sh (REQ-repo-uninstall).
# Removes ONLY the artifacts the installer placed; preserves seed-graph.mjs, this script,
# and any unrelated .claude/scripts content. Stops running services first.
#
# Usage: scripts/harness-uninstall.sh [--target DIR] [--purge] [--dry-run] [-y|--force]
#   --target DIR  Repo to uninstall from (default: current directory)
#   --purge       Also delete .aimprove/ (graph store + learning data). Default: kept.
#   --dry-run     Print what would be removed, change nothing.
#   -y, --force   Skip the confirmation prompt.
set -uo pipefail

PROJECT_ROOT="$(pwd)"
PURGE=false
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) PROJECT_ROOT="$(cd "$2" && pwd)"; shift 2 ;;
    --purge) PURGE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -y|--force) FORCE=true; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

cd "$PROJECT_ROOT" || { echo "ERROR: cannot cd to $PROJECT_ROOT" >&2; exit 1; }
PREFIX=""; $DRY_RUN && PREFIX="[dry-run] "

say() { echo "${PREFIX}$*"; }

# Files the installer (aimprove-init.sh) places into a target repo.
WIRING=(
  ".claude/hooks/graph-context.sh"
  ".claude/hooks/graph-extract.sh"
  ".claude/hooks/outcome-tracker.sh"
  ".claude/mcp-graph-server.js"
  "scripts/aimprove-local.sh"
  "src/graph-server.js"
)

echo "🧹 GraphCode Harness Uninstall"
echo "   Target: $PROJECT_ROOT"
echo "   Purge data (.aimprove/): $PURGE"
echo ""

# Confirmation (skipped on --force / --dry-run)
if ! $FORCE && ! $DRY_RUN; then
  read -r -p "Remove harness wiring from $PROJECT_ROOT? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 0 ;; esac
fi

# 1. Stop running services (server :3001 + dashboard :5174) before removing the controller.
if [ -f scripts/aimprove-local.sh ]; then
  say "Stopping services via scripts/aimprove-local.sh stop"
  $DRY_RUN || bash scripts/aimprove-local.sh stop >/dev/null 2>&1 || true
else
  for port in 3001 5174; do
    pid="$(lsof -ti :"$port" 2>/dev/null || true)"
    [ -n "$pid" ] && { say "Killing process on :$port (PID $pid)"; $DRY_RUN || kill "$pid" 2>/dev/null || true; }
  done
fi

# 2. Remove wiring files.
for f in "${WIRING[@]}"; do
  if [ -e "$f" ]; then
    say "rm $f"
    $DRY_RUN || rm -f "$f"
  fi
done

# 3. Remove .claude/hooks only if now empty (preserve unrelated hooks).
if [ -d .claude/hooks ] && [ -z "$(ls -A .claude/hooks 2>/dev/null)" ]; then
  say "rmdir .claude/hooks (empty)"
  $DRY_RUN || rmdir .claude/hooks
fi

# 4. .mcp.json — surgically drop the graph-server entry; remove file if no servers remain.
if [ -f .mcp.json ]; then
  if command -v jq >/dev/null 2>&1; then
    remaining="$(jq '(.mcpServers // {}) | del(.["graph-server"]) | length' .mcp.json 2>/dev/null || echo 1)"
    if [ "$remaining" = "0" ]; then
      say "rm .mcp.json (only graph-server entry remained)"
      $DRY_RUN || rm -f .mcp.json
    else
      say "edit .mcp.json (delete mcpServers.\"graph-server\", keep $remaining other server(s))"
      $DRY_RUN || { tmp="$(mktemp)"; jq 'del(.mcpServers["graph-server"])' .mcp.json > "$tmp" && mv "$tmp" .mcp.json; }
    fi
  else
    say "WARN: jq not found — leaving .mcp.json untouched; remove the \"graph-server\" entry manually."
  fi
fi

# 5. Graph store / learning data.
if [ -d .aimprove ]; then
  if $PURGE; then
    say "rm -rf .aimprove (purge: graph store + learning data)"
    $DRY_RUN || rm -rf .aimprove
  else
    say "keeping .aimprove/ (graph store/data) — re-run with --purge to delete"
  fi
fi

echo ""
echo "${PREFIX}✅ Uninstall complete."
$DRY_RUN && echo "(dry-run: nothing was changed)"
echo "Preserved: scripts/seed-graph.mjs, $(basename "$0"), and all unrelated .claude/ content."
