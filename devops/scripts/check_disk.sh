#!/usr/bin/env bash
# check_disk.sh — Monitor disk usage and log a warning when usage exceeds 80%.
#
# Usage (manual):
#   bash devops/scripts/check_disk.sh
#
# Cron example (run every hour as root or contentflow user with sudo access):
#   0 * * * * contentflow bash /var/www/contentflow/devops/scripts/check_disk.sh >> /var/log/contentflow/check_disk.log 2>&1
#
# To install the cron entry:
#   echo "0 * * * * contentflow bash /var/www/contentflow/devops/scripts/check_disk.sh >> /var/log/contentflow/check_disk.log 2>&1" \
#     | sudo tee -a /etc/crontab
#
# What it checks:
#   - Filesystem that contains /var/www/contentflow/media (AI-generated images
#     and other uploads can grow quickly).
#   - Threshold: 80%. Adjust THRESHOLD below if needed.
#
# Output:
#   - Always prints current usage to stdout (captured by cron redirect above).
#   - On threshold breach: writes WARNING line to stdout AND appends to
#     /var/log/contentflow/disk_alert.log for persistence.
#   - Exit 0 always (cron-safe; does not kill the job on alert).

set -euo pipefail

MEDIA_DIR="${MEDIA_DIR:-/var/www/contentflow/media}"
THRESHOLD=80
ALERT_LOG="/var/log/contentflow/disk_alert.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# Resolve the filesystem mount point for the media directory.
# df -P gives POSIX-format output; awk picks the "Use%" column.
USAGE_PCT=$(df -P "${MEDIA_DIR}" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')

if [ -z "${USAGE_PCT}" ]; then
  echo "[${TIMESTAMP}] ERROR: could not determine disk usage for ${MEDIA_DIR}"
  exit 0
fi

MOUNT=$(df -P "${MEDIA_DIR}" | awk 'NR==2 {print $6}')

echo "[${TIMESTAMP}] Disk usage on ${MOUNT}: ${USAGE_PCT}% (threshold: ${THRESHOLD}%)"

if [ "${USAGE_PCT}" -ge "${THRESHOLD}" ]; then
  MSG="[${TIMESTAMP}] WARNING: disk usage on ${MOUNT} is ${USAGE_PCT}% — exceeds ${THRESHOLD}% threshold. Check ${MEDIA_DIR} for large files."
  echo "${MSG}"
  # Ensure log directory exists before writing
  mkdir -p "$(dirname "${ALERT_LOG}")"
  echo "${MSG}" >> "${ALERT_LOG}"
fi

exit 0
