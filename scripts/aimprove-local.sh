#!/bin/bash
# Aimprove Harness Controller (CR-217)
# Launches full aimpro server + dashboard for local project
# Usage: scripts/aimprove-local.sh {start|stop|status|restart}

set -uo pipefail

# Configuration
PROJECT_ROOT="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
AIMPRO_ROOT="/Users/andreas/Developer/dev/aimpro"  # Embedded by aimprove-init.sh
PORT="${PORT:-3001}"
DASHBOARD_PORT="${DASHBOARD_PORT:-5174}"
PID_FILE="/tmp/aimprove-${PROJECT_NAME}-${PORT}.pid"
DASHBOARD_PID_FILE="/tmp/aimprove-dashboard-${PROJECT_NAME}-${DASHBOARD_PORT}.pid"
LOG_FILE="/tmp/aimprove-${PROJECT_NAME}-${PORT}.log"
DASHBOARD_LOG_FILE="/tmp/aimprove-dashboard-${PROJECT_NAME}-${DASHBOARD_PORT}.log"

# Helpers
log() { echo "[aimprove:$PROJECT_NAME] $*"; }
err() { echo "[aimprove:$PROJECT_NAME] ERROR: $*" >&2; }

# Verify aimpro installation
if [ ! -d "$AIMPRO_ROOT/src" ]; then
  err "Aimpro installation not found at: $AIMPRO_ROOT"
  err "AIMPRO_ROOT may need to be set in $0"
  exit 1
fi

# ============================================================================
# Commands
# ============================================================================

cmd_start() {
  # Check if already running
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Already running (PID $pid)"
      cmd_status
      return 0
    else
      rm -f "$PID_FILE"
    fi
  fi

  # Kill stale processes on ports
  for port in "$PORT" "$DASHBOARD_PORT"; do
    local stale_pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$stale_pid" ]; then
      log "Killing stale process on :$port (PID $stale_pid)"
      kill "$stale_pid" 2>/dev/null || true
      sleep 1
    fi
  done

  log "Starting full aimpro server on :$PORT..."
  cd "$PROJECT_ROOT"
  NODE_ENV=development PORT="$PORT" npx tsx "$AIMPRO_ROOT/src/server/index.ts" --repo "$PROJECT_ROOT" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  # Wait for server startup
  local server_ready=0
  for i in $(seq 1 30); do
    if curl -s --max-time 1 "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
      log "✓ Server ready (PID $(cat "$PID_FILE"))"
      server_ready=1
      break
    fi
    sleep 1
  done

  if [ "$server_ready" -eq 0 ]; then
    err "Server failed to start (timeout)"
    tail -10 "$LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
  fi

  # Start dashboard
  log "Starting dashboard on :$DASHBOARD_PORT..."
  cd "$AIMPRO_ROOT"
  API_PORT="$PORT" npx vite --config src/dashboard/vite.config.ts --port "$DASHBOARD_PORT" > "$DASHBOARD_LOG_FILE" 2>&1 &
  echo $! > "$DASHBOARD_PID_FILE"

  # Wait for dashboard startup
  local dashboard_ready=0
  for i in $(seq 1 15); do
    if curl -s --max-time 1 "http://localhost:$DASHBOARD_PORT/" > /dev/null 2>&1; then
      log "✓ Dashboard ready (PID $(cat "$DASHBOARD_PID_FILE"))"
      dashboard_ready=1
      break
    fi
    sleep 1
  done

  if [ "$dashboard_ready" -eq 0 ]; then
    log "⚠ Dashboard startup timeout (check $DASHBOARD_LOG_FILE)"
  fi

  echo ""
  log "🎉 Harness running:"
  log "   Server: http://localhost:$PORT"
  log "   Dashboard: http://localhost:$DASHBOARD_PORT"
  log "   Project: $PROJECT_ROOT"
  echo ""
}

cmd_stop() {
  local any_running=0

  # Stop server
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping server (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      any_running=1
    fi
    rm -f "$PID_FILE"
  fi

  # Stop dashboard
  if [ -f "$DASHBOARD_PID_FILE" ]; then
    local pid=$(cat "$DASHBOARD_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping dashboard (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      any_running=1
    fi
    rm -f "$DASHBOARD_PID_FILE"
  fi

  if [ "$any_running" -eq 1 ]; then
    log "✓ Stopped"
  else
    log "Not running"
  fi
}

cmd_status() {
  echo ""

  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  Server (PID $pid):"
      curl -s "http://localhost:$PORT/api/health" 2>/dev/null | \
        jq -r '"    \(.project | split(\"/\")[-1]) on \(.project)\n    Elements: \(.graph.elements) | Violations: \(.graph.violations)"' || echo "    (not responding)"
    fi
  fi

  if [ -f "$DASHBOARD_PID_FILE" ]; then
    local pid=$(cat "$DASHBOARD_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  Dashboard (PID $pid):"
      echo "    http://localhost:$DASHBOARD_PORT"
    fi
  fi

  echo ""
}

cmd_restart() {
  cmd_stop
  sleep 2
  cmd_start
}

# ============================================================================
# Main
# ============================================================================

case "${1:-start}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  restart) cmd_restart ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
