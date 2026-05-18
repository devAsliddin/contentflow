#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ContentFlow — Docker Logs Viewer
# Usage:
#   bash devops/scripts/docker-logs.sh backend
#   bash devops/scripts/docker-logs.sh celery
#   bash devops/scripts/docker-logs.sh celery-beat
#   bash devops/scripts/docker-logs.sh nginx
#   bash devops/scripts/docker-logs.sh frontend
#   bash devops/scripts/docker-logs.sh postgres
#   bash devops/scripts/docker-logs.sh redis
#   bash devops/scripts/docker-logs.sh all
# ─────────────────────────────────────────────────────────────────────────────

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

APP_DIR="${APP_DIR:-/opt/contentflow}"
TAIL="${TAIL:-100}"
SERVICE="${1:-}"

# ── Resolve APP_DIR ───────────────────────────────────────────────────────────
# If called from the repo root, use that instead
if [ -f "./docker-compose.yml" ]; then
  APP_DIR="."
fi
cd "$APP_DIR"

# ── Help text ─────────────────────────────────────────────────────────────────
usage() {
  echo -e "${BOLD}Usage:${NC} $(basename "$0") <service> [--tail=N]"
  echo ""
  echo -e "${BOLD}Services:${NC}"
  echo -e "  ${CYAN}backend${NC}      FastAPI application"
  echo -e "  ${CYAN}celery${NC}       Celery worker"
  echo -e "  ${CYAN}celery-beat${NC}  Celery beat scheduler"
  echo -e "  ${CYAN}nginx${NC}        Nginx reverse proxy"
  echo -e "  ${CYAN}frontend${NC}     React frontend (nginx)"
  echo -e "  ${CYAN}postgres${NC}     PostgreSQL database"
  echo -e "  ${CYAN}redis${NC}        Redis"
  echo -e "  ${CYAN}all${NC}          All services combined"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo -e "  --tail=N     Number of lines to show from the end (default: 100)"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo -e "  $(basename "$0") backend"
  echo -e "  $(basename "$0") all"
  echo -e "  TAIL=200 $(basename "$0") celery"
}

# ── Parse --tail=N argument ───────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --tail=*) TAIL="${arg#--tail=}" ;;
  esac
done

# ── Run logs ──────────────────────────────────────────────────────────────────
run_logs() {
  local service="$1"
  echo -e "${BOLD}${CYAN}--- Logs: ${service} (tail=${TAIL}) ---${NC}"
  docker compose logs -f --tail="$TAIL" $service
}

case "$SERVICE" in
  backend)
    run_logs backend
    ;;
  celery)
    run_logs celery
    ;;
  celery-beat)
    run_logs celery-beat
    ;;
  nginx)
    run_logs nginx
    ;;
  frontend)
    run_logs frontend
    ;;
  postgres|db)
    run_logs postgres
    ;;
  redis)
    run_logs redis
    ;;
  all|"")
    echo -e "${BOLD}${CYAN}--- All Services (tail=${TAIL}) ---${NC}"
    docker compose logs -f --tail="$TAIL"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    log_error "Unknown service: '${SERVICE}'"
    echo ""
    usage
    exit 1
    ;;
esac
