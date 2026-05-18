#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ContentFlow — Docker Deploy Script
# Usage: bash devops/scripts/docker-deploy.sh [--no-cache]
# ─────────────────────────────────────────────────────────────────────────────

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()    { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }

DEPLOY_DIR="/opt/contentflow"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
BUILD_FLAGS=""
HEALTH_URL="http://localhost/api/health"
HEALTH_RETRIES=10
HEALTH_SLEEP=6

# ── Parse arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --no-cache) BUILD_FLAGS="--no-cache" ;;
    --pull)     BUILD_FLAGS="--pull" ;;
    *) log_warn "Unknown argument: $arg" ;;
  esac
done

cd "$DEPLOY_DIR"

# ── 1. Check .env ─────────────────────────────────────────────────────────────
log_step "Checking environment"
if [ ! -f "$ENV_FILE" ]; then
  log_error ".env file not found at ${ENV_FILE}"
  log_error "Copy .env.example to .env and fill in the required values."
  exit 1
fi
log_success ".env found"

# ── 2. Git pull ───────────────────────────────────────────────────────────────
log_step "Pulling latest code from git"
git fetch --all
BEFORE_SHA=$(git rev-parse HEAD)
git pull origin main
AFTER_SHA=$(git rev-parse HEAD)

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  log_warn "No new commits. Deploying anyway."
else
  log_success "Updated ${BEFORE_SHA:0:7} → ${AFTER_SHA:0:7}"
fi

# ── 3. Save current image IDs for rollback ────────────────────────────────────
log_step "Saving current image state for rollback"
PREV_BACKEND_IMAGE=$(docker compose ps -q backend 2>/dev/null | xargs -r docker inspect --format='{{.Image}}' 2>/dev/null || true)
PREV_FRONTEND_IMAGE=$(docker compose ps -q frontend 2>/dev/null | xargs -r docker inspect --format='{{.Image}}' 2>/dev/null || true)
log_info "Previous backend image : ${PREV_BACKEND_IMAGE:-none}"
log_info "Previous frontend image: ${PREV_FRONTEND_IMAGE:-none}"

# ── 4. Build new images ───────────────────────────────────────────────────────
log_step "Building Docker images${BUILD_FLAGS:+ (${BUILD_FLAGS})}"
docker compose build ${BUILD_FLAGS} backend celery celery-beat frontend
log_success "Images built"

# ── 5. Rolling restart ────────────────────────────────────────────────────────
log_step "Starting services (rolling restart)"
docker compose up -d --remove-orphans
log_success "Containers started"

# ── 6. Run database migrations ────────────────────────────────────────────────
log_step "Running Alembic migrations"
# Wait for backend to be healthy first
WAIT=0
until docker compose exec -T backend curl -sf http://localhost:8000/api/health > /dev/null 2>&1; do
  WAIT=$((WAIT + 1))
  if [ "$WAIT" -ge 20 ]; then
    log_error "Backend container did not become healthy before migrations (timeout 120s)"
    break
  fi
  log_info "Waiting for backend... (${WAIT}/20)"
  sleep 6
done

docker compose exec -T backend python -m alembic upgrade head
log_success "Migrations applied"

# ── 7. Health check ───────────────────────────────────────────────────────────
log_step "Running health check"
ATTEMPT=0
HEALTHY=false

until [ "$ATTEMPT" -ge "$HEALTH_RETRIES" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" "$HEALTH_URL" || true)
  if [ "$HTTP_CODE" = "200" ]; then
    HEALTHY=true
    break
  fi
  log_info "Health check attempt ${ATTEMPT}/${HEALTH_RETRIES} — HTTP ${HTTP_CODE}"
  sleep "$HEALTH_SLEEP"
done

if [ "$HEALTHY" = true ]; then
  log_success "Health check passed (HTTP 200)"
else
  # ── 8. Rollback on failure ─────────────────────────────────────────────────
  log_error "Health check FAILED after $((HEALTH_RETRIES * HEALTH_SLEEP))s"
  log_warn "Rolling back to previous images..."

  if [ -n "$PREV_BACKEND_IMAGE" ] || [ -n "$PREV_FRONTEND_IMAGE" ]; then
    # Restore git to previous commit
    git checkout "$BEFORE_SHA" -- .
    docker compose up -d --remove-orphans
    log_warn "Rollback attempted. Please verify manually."
  else
    log_warn "No previous images found — cannot rollback automatically."
  fi

  log_error "Deployment FAILED. Check logs:"
  log_error "  docker compose logs --tail=50 backend"
  log_error "  docker compose logs --tail=50 nginx"
  exit 1
fi

# ── 9. Cleanup dangling images ────────────────────────────────────────────────
log_step "Cleaning up dangling images"
docker image prune -f > /dev/null 2>&1 || true
log_success "Cleanup done"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Deployment successful!${NC}"
echo -e "  Commit : ${AFTER_SHA:0:7}"
echo -e "  URL    : $HEALTH_URL"
echo ""
