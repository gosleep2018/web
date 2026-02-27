#!/usr/bin/env bash
set -euo pipefail

# One-click recovery for a fresh macOS install
# Usage:
#   1) Copy this script + backup folder to new Mac
#   2) Run: bash rebuild_openclaw_on_new_mac.sh

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_DIR="$HOME/.openclaw"
CONFIG_PATH="$OPENCLAW_DIR/openclaw.json"

echo "[1/7] Checking OpenClaw CLI..."
if ! command -v openclaw >/dev/null 2>&1; then
  echo "[ERROR] openclaw command not found."
  echo "Please install OpenClaw first, then re-run this script."
  exit 1
fi

echo "[2/7] Ensuring ~/.openclaw exists..."
mkdir -p "$OPENCLAW_DIR"

echo "[3/7] Locating latest config backup..."
LATEST_BACKUP="$(ls -1t "$BACKUP_DIR"/openclaw.json.backup-* 2>/dev/null | head -n 1 || true)"
if [[ -z "${LATEST_BACKUP}" ]]; then
  echo "[ERROR] No backup found in: $BACKUP_DIR"
  echo "Expected file pattern: openclaw.json.backup-*"
  exit 1
fi

echo "[4/7] Restoring config from: $LATEST_BACKUP"
cp "$LATEST_BACKUP" "$CONFIG_PATH"

# Restore practical permission first for startup
chmod 600 "$CONFIG_PATH"

echo "[5/7] Restarting gateway..."
openclaw gateway restart || openclaw gateway start

echo "[6/7] Waiting 2s and checking status..."
sleep 2
openclaw gateway status || true

echo "[7/7] Re-locking config to read-only (high safety)..."
chmod 400 "$CONFIG_PATH"

echo ""
echo "✅ Recovery complete."
echo "Config: $CONFIG_PATH"
echo "Backup source: $LATEST_BACKUP"
echo ""
echo "Next recommended checks:"
echo "  - Verify model fallback chain in OpenClaw"
echo "  - Re-auth Gemini later if needed"
