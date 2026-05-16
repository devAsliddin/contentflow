#!/usr/bin/env bash
# ContentFlow Deploy Script
# Run from /var/www/contentflow as contentflow user
# Usage: bash devops/scripts/deploy.sh

set -euo pipefail

APP_DIR="/var/www/contentflow"
VENV="$APP_DIR/venv"
LOG_FILE="/var/log/contentflow/deploy.log"
ROLLBACK_TAG=""

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "DEPLOY FAILED: $*"
  if [ -n "$ROLLBACK_TAG" ]; then
    log "Rolling back to $ROLLBACK_TAG..."
    git checkout "$ROLLBACK_TAG" -- .
    restart_services
    log "Rollback complete"
  fi
  exit 1
}

restart_services() {
  sudo systemctl restart contentflow-backend    || true
  sudo systemctl restart contentflow-celery     || true
  sudo systemctl restart contentflow-celery-beat || true
  sudo systemctl reload  nginx                  || true
}

log "==> Starting ContentFlow deployment"
cd "$APP_DIR"

# ──── Save rollback point ────────────────────────────────────────────
ROLLBACK_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "")
log "Rollback point: ${ROLLBACK_TAG:-none}"

# ──── Pull latest code ───────────────────────────────────────────────
log "==> Pulling latest code..."
git fetch origin main || fail "git fetch failed"
git reset --hard origin/main || fail "git reset failed"
log "Code updated to $(git rev-parse --short HEAD)"

# ──── Backend: install deps ──────────────────────────────────────────
log "==> Installing Python dependencies..."
"$VENV/bin/pip" install --upgrade pip -q
"$VENV/bin/pip" install -r backend/requirements.txt -q || fail "pip install failed"

# ──── Backend: run migrations ────────────────────────────────────────
log "==> Running database migrations..."
cd backend
"$VENV/bin/python" -m alembic upgrade head || fail "alembic migration failed"
cd ..

# ──── Frontend: build ────────────────────────────────────────────────
log "==> Building frontend..."
cd frontend
npm ci --silent || fail "npm ci failed"
npm run build || fail "frontend build failed"
cd ..

# ──── Copy frontend build to Nginx root ──────────────────────────────
log "==> Updating Nginx static files..."
rsync -a --delete frontend/dist/ /var/www/html/contentflow/

# ──── Ensure media dir exists with correct permissions ───────────────
mkdir -p "$APP_DIR/media"
chown contentflow:www-data "$APP_DIR/media"
chmod 750 "$APP_DIR/media"

# ──── Install systemd services ───────────────────────────────────────
log "==> Installing systemd service files..."
sudo cp devops/systemd/contentflow-backend.service    /etc/systemd/system/
sudo cp devops/systemd/contentflow-celery.service     /etc/systemd/system/
sudo cp devops/systemd/contentflow-celery-beat.service /etc/systemd/system/
sudo systemctl daemon-reload

# ──── Restart services ───────────────────────────────────────────────
log "==> Restarting services..."
restart_services
sleep 4

# ──── Health check ───────────────────────────────────────────────────
log "==> Running health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health)
if [ "$HEALTH" != "200" ]; then
  fail "Health check failed (HTTP $HEALTH)"
fi
log "Health check passed (HTTP $HEALTH)"

log "==> Deployment complete! Git commit: $(git rev-parse --short HEAD)"
