#!/usr/bin/env bash
# ContentFlow Database Backup Script
# Add to crontab: 0 2 * * * /var/www/contentflow/devops/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/var/backups/contentflow"
LOG_FILE="/var/log/contentflow/backup.log"
DB_NAME="contentflow"
KEEP_DAYS=7

DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/contentflow_$DATE.sql.gz"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

log "Starting backup: $BACKUP_FILE"

pg_dump -U contentflow -h localhost "$DB_NAME" | gzip > "$BACKUP_FILE" || {
  log "ERROR: pg_dump failed"
  exit 1
}

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup complete: $BACKUP_FILE ($SIZE)"

# Remove backups older than KEEP_DAYS
log "Removing backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "contentflow_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
REMAINING=$(find "$BACKUP_DIR" -name "contentflow_*.sql.gz" | wc -l)
log "Remaining backups: $REMAINING"
