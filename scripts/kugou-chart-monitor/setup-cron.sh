#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRON_TIME="09:00"  # 每天上午9点运行

echo "安装酷狗榜单监控cron任务..."
echo "运行时间: 每天 $CRON_TIME (新加坡时间)"
echo "脚本路径: $SCRIPT_DIR/kugou-chart-monitor.js"

# 创建cron job（通过OpenClaw cron工具）
openclaw cron add \
  --name "daily-kugou-chart-monitor" \
  --schedule "cron:0 9 * * *" \
  --session-target isolated \
  --payload '{
    "kind": "agentTurn",
    "message": "运行酷狗榜单监控脚本并报告变化",
    "model": "openai-codex/gpt-5.3-codex"
  }' \
  --delivery '{
    "mode": "announce",
    "channel": "telegram",
    "to": "Boss"
  }'

echo "✅ cron任务已添加"
echo "查看任务列表: openclaw cron list"
