#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ContentFlow — Docker PostgreSQL Backup Script
# Cron example: 0 2 * * * bash /opt/contentflow/devops/scripts/docker-backup.sh
# ─────────────────────────────────────────────────────────────────────────────

# Colors (only when running interactively)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' CYAN='' NC=''
fi

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

APP_DIR="${APP_DIR:-/opt/contentflow}"
BACKUP_DIR="/var/backups/contentflow"
RETAIN_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/contentflow_${TIMESTAMP}.sql.gz"

cd "$APP_DIR"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if ! docker compose ps postgres | grep -q "running\|Up"; then
  log_error "postgres container is not running. Aborting backup."
  exit 1
fi

# ── Create backup directory ───────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Read DB credentials from .env ─────────────────────────────────────────────
if [ -f "${APP_DIR}/.env" ]; then
  # shellcheck disable=SC1091
  set -o allexport
  source "${APP_DIR}/.env"
  set +o allexport
fi

DB_USER="${POSTGRES_USER:-contentflow}"
DB_NAME="${POSTGRES_DB:-contentflow}"

# ── Dump and compress ─────────────────────────────────────────────────────────
log_info "Starting backup: ${BACKUP_FILE}"
log_info "Database: ${DB_NAME} (user: ${DB_USER})"

docker compose exec -T postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log_success "Backup saved: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Remove old backups ────────────────────────────────────────────────────────
log_info "Removing backups older than ${RETAIN_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "contentflow_*.sql.gz" -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  log_success "Removed ${DELETED} old backup(s)"
else
  log_info "No old backups to remove"
fi

# ── List current backups ──────────────────────────────────────────────────────
log_info "Current backups in ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}"/contentflow_*.sql.gz 2>/dev/null || log_warn "No backup files found."

echo ""
log_success "Backup complete at $(date '+%Y-%m-%d %H:%M:%S')"
