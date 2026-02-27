#!/bin/zsh
set -euo pipefail
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

get_lan_ip() {
  local iface ip
  iface="$(/sbin/route get default 2>/dev/null | awk '/interface:/{print $2}' | head -n1 || true)"
  if [[ -n "${iface:-}" ]]; then
    ip="$(/usr/sbin/ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      echo "$ip"
      return 0
    fi
  fi

  for cand in en0 en1; do
    ip="$(/usr/sbin/ipconfig getifaddr "$cand" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      echo "$ip"
      return 0
    fi
  done

  return 1
}

# 等网关起来（最多60秒）
for i in {1..30}; do
  if openclaw gateway health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# 等网络内网IP就绪（最多120秒）
LAN_IP=""
for i in {1..60}; do
  LAN_IP="$(get_lan_ip || true)"
  if [[ -n "${LAN_IP:-}" ]]; then
    break
  fi
  sleep 2
done

if [[ -n "${LAN_IP:-}" ]]; then
  MSG="✅ OpenClaw 服务已在线（开机自检通过）｜内网IP: ${LAN_IP}"
else
  MSG="✅ OpenClaw 服务已在线（开机自检通过）｜内网IP: 未获取到"
fi

openclaw message send --channel telegram --target 549213839 --message "$MSG"
