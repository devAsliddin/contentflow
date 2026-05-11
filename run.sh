#!/usr/bin/env bash
# ContentFlow — Local Development Runner
# Usage: bash run.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/venv"
LOG_DIR="$ROOT/.logs"
PID_FILE="$ROOT/.run.pids"

mkdir -p "$LOG_DIR"
> "$PID_FILE"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[run]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}  $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[err]${NC}  $*"; }

# ── Cleanup on exit ─────────────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down ContentFlow..."
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  killed pid $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
  ok "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Check dependencies ───────────────────────────────────────────────
check_dep() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is not installed. $2"
    exit 1
  fi
}

log "Checking dependencies..."
check_dep python3   "Install Python 3.11+ from https://python.org"
check_dep node      "Install Node.js 20+ from https://nodejs.org"
check_dep redis-cli "Install Redis: brew install redis  OR  apt install redis"
check_dep psql      "Install PostgreSQL 15: brew install postgresql  OR  apt install postgresql"

# ── Check Redis is running ───────────────────────────────────────────
if ! redis-cli ping &>/dev/null; then
  warn "Redis is not running. Attempting to start..."
  if command -v redis-server &>/dev/null; then
    redis-server --daemonize yes --logfile "$LOG_DIR/redis.log"
    sleep 1
    redis-cli ping &>/dev/null && ok "Redis started." || { err "Could not start Redis."; exit 1; }
  else
    err "Please start Redis manually: redis-server"
    exit 1
  fi
else
  ok "Redis is running."
fi

# ── .env check ───────────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  warn ".env not found. Copying from .env.example..."
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  warn "Edit $BACKEND/.env with your database credentials before continuing."
  warn "Press Enter to continue anyway (some features may not work)..."
  read -r
fi

# ── Python virtualenv ────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  log "Creating Python virtual environment..."
  python3 -m venv "$VENV"
  ok "Virtual environment created."
fi

log "Installing Python dependencies..."
"$VENV/bin/pip" install --upgrade pip -q
"$VENV/bin/pip" install -r "$BACKEND/requirements.txt" -q
ok "Python dependencies ready."

# ── Database setup ───────────────────────────────────────────────────
log "Checking database..."
DB_URL=$(grep DATABASE_URL "$BACKEND/.env" 2>/dev/null | cut -d= -f2- | tr -d ' "' || echo "")
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///' | cut -d? -f1)
DB_NAME="${DB_NAME:-contentflow}"

if psql -lqt 2>/dev/null | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  ok "Database '$DB_NAME' exists."
else
  warn "Database '$DB_NAME' not found. Creating..."
  createdb "$DB_NAME" 2>/dev/null && ok "Database '$DB_NAME' created." || warn "Could not create database. Check PostgreSQL is running."
fi

log "Running database migrations..."
cd "$BACKEND"
"$VENV/bin/python" -m alembic upgrade head 2>&1 | tail -3
cd "$ROOT"
ok "Migrations applied."

# ── Node dependencies ────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  log "Installing Node dependencies (first run)..."
  cd "$FRONTEND" && npm install --silent && cd "$ROOT"
  ok "Node dependencies installed."
else
  ok "Node dependencies already installed."
fi

# ── Create .env.local for frontend ──────────────────────────────────
if [ ! -f "$FRONTEND/.env.local" ]; then
  echo "VITE_API_URL=http://localhost:8000/api/v1" > "$FRONTEND/.env.local"
fi

# ── Start services ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Starting ContentFlow                               ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# FastAPI backend
log "Starting FastAPI backend (port 8000)..."
cd "$BACKEND"
"$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >> "$PID_FILE"
cd "$ROOT"

# Wait for backend to be ready
sleep 2
if kill -0 "$BACKEND_PID" 2>/dev/null; then
  ok "Backend started (pid $BACKEND_PID) → http://localhost:8000/api/docs"
else
  err "Backend failed to start. Check $LOG_DIR/backend.log"
  exit 1
fi

# Celery worker
log "Starting Celery worker..."
cd "$BACKEND"
"$VENV/bin/celery" -A app.tasks.celery_app worker --loglevel=warning --concurrency=2 \
  > "$LOG_DIR/celery.log" 2>&1 &
CELERY_PID=$!
echo "$CELERY_PID" >> "$PID_FILE"
cd "$ROOT"
ok "Celery worker started (pid $CELERY_PID)"

# Vite frontend
log "Starting Vite frontend (port 5173)..."
cd "$FRONTEND"
npm run dev -- --host 0.0.0.0 \
  > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PID_FILE"
cd "$ROOT"
sleep 2
if kill -0 "$FRONTEND_PID" 2>/dev/null; then
  ok "Frontend started (pid $FRONTEND_PID) → http://localhost:5173"
else
  err "Frontend failed to start. Check $LOG_DIR/frontend.log"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}Frontend${NC}   →  http://localhost:5173"
echo -e "  ${CYAN}API${NC}        →  http://localhost:8000/api/v1"
echo -e "  ${CYAN}Swagger${NC}    →  http://localhost:8000/api/docs"
echo -e ""
echo -e "  Logs:  ${LOG_DIR}/"
echo -e "  Press ${RED}Ctrl+C${NC} to stop all services."
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Keep running until Ctrl+C
wait
