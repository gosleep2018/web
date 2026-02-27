#!/bin/zsh
set -euo pipefail

STATE_FILE="$HOME/.openclaw/gateway-monitor.state"
LABEL="ai.openclaw.gateway"

get_pid() {
  pgrep -f "openclaw/dist/index.js gateway --port 18789" | head -n 1 || true
}

last_pid=""
if [[ -f "$STATE_FILE" ]]; then
  last_pid="$(cat "$STATE_FILE" 2>/dev/null || true)"
fi

while true; do
  cur_pid="$(get_pid)"

  if [[ -n "$cur_pid" ]]; then
    if [[ -n "$last_pid" && "$cur_pid" != "$last_pid" ]]; then
      openclaw message send --channel telegram --target 549213839 --message "♻️ OpenClaw 网关已自动恢复（PID: $cur_pid）" >/dev/null 2>&1 || true
    fi
    if [[ "$cur_pid" != "$last_pid" ]]; then
      echo "$cur_pid" > "$STATE_FILE"
      last_pid="$cur_pid"
    fi
  fi

  sleep 20
done
