#!/usr/bin/env bash
# check_vllm.sh — vLLM endpoint health check
# Usage: bash devops/scripts/check_vllm.sh
# Exit 0 = healthy, Exit 1 = unreachable or error
#
# Cron example (every 5 minutes):
#   */5 * * * * contentflow bash /var/www/contentflow/devops/scripts/check_vllm.sh >> /var/log/contentflow/check_vllm.log 2>&1
#
# Systemd timer example — create two files:
#
# /etc/systemd/system/contentflow-check-vllm.service
# ─────────────────────────────────────────────────────
# [Unit]
# Description=ContentFlow vLLM health check
#
# [Service]
# Type=oneshot
# User=contentflow
# EnvironmentFile=/etc/contentflow/.env
# ExecStart=/var/www/contentflow/devops/scripts/check_vllm.sh
# StandardOutput=journal
# StandardError=journal
# SyslogIdentifier=contentflow-check-vllm
#
# /etc/systemd/system/contentflow-check-vllm.timer
# ─────────────────────────────────────────────────────
# [Unit]
# Description=Run vLLM health check every 5 minutes
# Requires=contentflow-check-vllm.service
#
# [Timer]
# OnBootSec=2min
# OnUnitActiveSec=5min
# Unit=contentflow-check-vllm.service
#
# [Install]
# WantedBy=timers.target
#
# Enable: sudo systemctl enable --now contentflow-check-vllm.timer

set -euo pipefail

LOG_TAG="check_vllm"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# VLLM_BASE_URL must be set in /etc/contentflow/.env, e.g.:
#   VLLM_BASE_URL=http://127.0.0.1:8000/v1
if [ -z "${VLLM_BASE_URL:-}" ]; then
  echo "[$TIMESTAMP] [$LOG_TAG] ERROR: VLLM_BASE_URL is not set" >&2
  exit 1
fi

MODELS_URL="${VLLM_BASE_URL}/models"

if curl -sf --max-time 5 "$MODELS_URL" > /dev/null 2>&1; then
  echo "[$TIMESTAMP] [$LOG_TAG] OK: vLLM reachable at $MODELS_URL"
  exit 0
else
  echo "[$TIMESTAMP] [$LOG_TAG] FAIL: vLLM unreachable at $MODELS_URL" >&2
  exit 1
fi
