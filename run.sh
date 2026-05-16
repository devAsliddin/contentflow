#!/usr/bin/env bash
# ContentFlow — One-command local dev runner (Windows Git Bash / Linux / macOS)
# Usage: bash run.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOG_DIR="$ROOT/.logs"
PID_FILE="$ROOT/.run.pids"

# ── Tool paths ────────────────────────────────────────────────────────
REDIS_SERVER="/c/tools/redis/redis-server.exe"
REDIS_CLI="/c/tools/redis/redis-cli.exe"

# PostgreSQL 17 moved to D:
PGDIR="/d/PostgreSQL/17"
PGDATA="D:/PostgreSQL/17/data"

# Fall back to system PATH if not found at Windows paths
command -v redis-cli    &>/dev/null && REDIS_CLI="redis-cli"
command -v redis-server &>/dev/null && REDIS_SERVER="redis-server"
[ -f "$REDIS_CLI" ]     || REDIS_CLI="redis-cli"
[ -f "$REDIS_SERVER" ]  || REDIS_SERVER="redis-server"

PSQL="$PGDIR/bin/psql.exe"
PG_CTL="$PGDIR/bin/pg_ctl.exe"
command -v psql    &>/dev/null && PSQL="psql"
command -v pg_ctl  &>/dev/null && PG_CTL="pg_ctl"

# ── On Windows use Scripts/, on Unix use bin/ ────────────────────────
if [ -d "$BACKEND/venv/Scripts" ]; then
  VENV_BIN="$BACKEND/venv/Scripts"
else
  VENV_BIN="$BACKEND/venv/bin"
fi

mkdir -p "$LOG_DIR"
> "$PID_FILE"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[run]${NC} $*"; }
ok()   { echo -e "${GREEN}[ ok]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[err]${NC} $*"; }

# ── Cleanup on Ctrl+C / exit ─────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down ContentFlow..."
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "  stopped pid $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"

  # Stop PostgreSQL gracefully
  if [ -f "$PG_CTL" ] || command -v pg_ctl &>/dev/null; then
    "$PG_CTL" -D "$PGDATA" stop -m fast 2>/dev/null || true
  fi

  ok "All services stopped. Bye!"
}
trap cleanup EXIT INT TERM

# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ContentFlow — Starting...${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Redis ──────────────────────────────────────────────────────────
log "Checking Redis..."
if "$REDIS_CLI" ping &>/dev/null 2>&1; then
  ok "Redis already running"
else
  log "Starting Redis..."
  if [ -f "$REDIS_SERVER" ]; then
    "$REDIS_SERVER" --port 6379 --loglevel warning > "$LOG_DIR/redis.log" 2>&1 &
    echo "$!" >> "$PID_FILE"
    sleep 1
    "$REDIS_CLI" ping &>/dev/null && ok "Redis started" || { err "Redis failed — check $LOG_DIR/redis.log"; exit 1; }
  else
    err "Redis not found. Run: choco install redis-64"
    exit 1
  fi
fi

# ── 2. PostgreSQL ─────────────────────────────────────────────────────
log "Checking PostgreSQL..."
pg_ping() {
  PGPASSWORD=contentflow123 "$PSQL" -U contentflow -d contentflow -h localhost -c "SELECT 1" &>/dev/null 2>&1
}

if pg_ping; then
  ok "PostgreSQL already running"
else
  log "Starting PostgreSQL..."
  # Try Windows service first
  if sc query postgresql-x64-17 2>/dev/null | grep -q "RUNNING"; then
    ok "PostgreSQL service running"
  elif [ -f "$PG_CTL" ]; then
    "$PG_CTL" -D "$PGDATA" -l "$LOG_DIR/postgres.log" start > /dev/null 2>&1
    sleep 2
    pg_ping && ok "PostgreSQL started" \
      || { err "PostgreSQL failed — check $LOG_DIR/postgres.log"; exit 1; }
  else
    err "PostgreSQL not found at $PGDIR"
    err "Install: winget install PostgreSQL.PostgreSQL.17"
    exit 1
  fi

  # Wait for connection after service start
  for i in 1 2 3 4 5; do
    pg_ping && break
    sleep 1
  done
  pg_ping || { err "Cannot connect to PostgreSQL"; exit 1; }
  ok "PostgreSQL ready"
fi

# ── 3. Python venv ────────────────────────────────────────────────────
if [ ! -d "$BACKEND/venv" ]; then
  log "Creating Python virtual environment..."
  python -m venv "$BACKEND/venv"
  ok "Virtualenv created"
fi

if [ ! -f "$VENV_BIN/fastapi" ] && [ ! -f "$VENV_BIN/uvicorn" ] && [ ! -f "$VENV_BIN/uvicorn.exe" ]; then
  log "Installing Python dependencies..."
  "$VENV_BIN/pip" install --upgrade pip -q
  "$VENV_BIN/pip" install --only-binary=:all: -r "$BACKEND/requirements.txt" -q
  ok "Python dependencies installed"
else
  ok "Python dependencies already installed"
fi

# ── 4. DB Migrations ──────────────────────────────────────────────────
log "Running database migrations..."
cd "$BACKEND"
"$VENV_BIN/python" -m alembic upgrade head 2>&1 | grep -E "Running|up to date|INFO" | sed 's/INFO  \[.*\] //' || true
cd "$ROOT"
ok "Migrations up to date"

# ── 5. Node deps ──────────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  log "Installing Node dependencies..."
  cd "$FRONTEND" && npm install --silent && cd "$ROOT"
  ok "Node dependencies installed"
else
  ok "Node dependencies ready"
fi

# Ensure frontend .env.local exists
[ -f "$FRONTEND/.env.local" ] || echo "VITE_API_URL=/api/v1" > "$FRONTEND/.env.local"

# ── 6. Ollama (local AI) — start early so it's ready before backend ───
OLLAMA_DEFAULT_MODEL="llama3.2"
OLLAMA_RUNNING=false
OLLAMA_CMD=""

log "Checking Ollama (local AI)..."

WIN_USER="${USERNAME:-${USER:-$(whoami 2>/dev/null || echo '')}}"
for candidate in \
  "ollama" \
  "/c/Users/$WIN_USER/AppData/Local/Programs/Ollama/ollama.exe" \
  "$LOCALAPPDATA/Programs/Ollama/ollama.exe" \
  "/usr/local/bin/ollama" \
  "/usr/bin/ollama"; do
  if command -v "$candidate" &>/dev/null 2>&1 || [ -f "$candidate" ]; then
    OLLAMA_CMD="$candidate"
    break
  fi
done

ollama_api_ping() {
  curl -sf http://localhost:11434/api/tags &>/dev/null 2>&1
}

if ollama_api_ping; then
  ok "Ollama already running (http://localhost:11434)"
  OLLAMA_RUNNING=true
elif [ -n "$OLLAMA_CMD" ]; then
  log "Starting Ollama..."
  "$OLLAMA_CMD" serve > "$LOG_DIR/ollama.log" 2>&1 &
  OLLAMA_PID=$!
  echo "$OLLAMA_PID" >> "$PID_FILE"
  for i in 1 2 3 4 5 6 7 8; do
    ollama_api_ping && break
    sleep 1
  done
  if ollama_api_ping; then
    ok "Ollama started (pid $OLLAMA_PID)"
    OLLAMA_RUNNING=true
  else
    warn "Ollama did not respond — AI Chat may not work. Check $LOG_DIR/ollama.log"
  fi
else
  warn "Ollama not found — AI Chat will be unavailable."
  warn "Install: https://ollama.com/download  then run: ollama pull $OLLAMA_DEFAULT_MODEL"
fi

if $OLLAMA_RUNNING && [ -n "$OLLAMA_CMD" ]; then
  if ! "$OLLAMA_CMD" list 2>/dev/null | grep -q "$OLLAMA_DEFAULT_MODEL"; then
    log "Pulling '$OLLAMA_DEFAULT_MODEL' (bu bir necha daqiqa olishi mumkin)..."
    "$OLLAMA_CMD" pull "$OLLAMA_DEFAULT_MODEL" > "$LOG_DIR/ollama_pull.log" 2>&1 &
    PULL_PID=$!
    echo "$PULL_PID" >> "$PID_FILE"
    ok "Pulling '$OLLAMA_DEFAULT_MODEL' background da (pid $PULL_PID)"
  else
    ok "Model '$OLLAMA_DEFAULT_MODEL' tayyor"
  fi
fi

# ── 7. Start FastAPI ──────────────────────────────────────────────────
log "Starting FastAPI backend..."
cd "$BACKEND"
"$VENV_BIN/uvicorn" app.main:app --host 0.0.0.0 --port 8001 --reload \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >> "$PID_FILE"
cd "$ROOT"
sleep 2
kill -0 "$BACKEND_PID" 2>/dev/null \
  && ok "Backend started (pid $BACKEND_PID)" \
  || { err "Backend failed — check $LOG_DIR/backend.log"; cat "$LOG_DIR/backend.log" | tail -20; exit 1; }

# ── 7. Start Celery ───────────────────────────────────────────────────
log "Starting Celery worker..."
cd "$BACKEND"
"$VENV_BIN/celery" -A app.tasks.celery_app worker --loglevel=warning --concurrency=2 \
  -P solo \
  > "$LOG_DIR/celery.log" 2>&1 &
CELERY_PID=$!
echo "$CELERY_PID" >> "$PID_FILE"
cd "$ROOT"
ok "Celery worker started (pid $CELERY_PID)"

# ── 9. Start Vite ─────────────────────────────────────────────────────
log "Starting Vite frontend..."
cd "$FRONTEND"
npm run dev -- --host 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
VITE_PID=$!
echo "$VITE_PID" >> "$PID_FILE"
cd "$ROOT"
sleep 3
kill -0 "$VITE_PID" 2>/dev/null \
  && ok "Frontend started (pid $VITE_PID)" \
  || { err "Frontend failed — check $LOG_DIR/frontend.log"; exit 1; }

# ── Ready ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}App${NC}      →  ${BOLD}http://localhost:5173${NC}"
echo -e "  ${CYAN}API${NC}      →  http://localhost:8001/api/v1"
echo -e "  ${CYAN}Swagger${NC}  →  http://localhost:8001/api/docs"
if $OLLAMA_RUNNING; then
echo -e "  ${CYAN}Ollama${NC}   →  http://localhost:11434  (AI Chat aktiv)"
else
echo -e "  ${YELLOW}Ollama${NC}   →  offline  (AI Chat ishlamaydi)"
fi
echo -e ""
echo -e "  Logs: ${LOG_DIR}/"
echo -e "  ${RED}Ctrl+C${NC} to stop everything."
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

wait
