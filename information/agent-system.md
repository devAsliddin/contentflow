# ContentFlow — Agent System

## Overview

ContentFlow uses a 4-agent system to parallelize development and maintain clear separation of concerns. Each agent has a defined scope, uses the optimal Claude model for its tasks, and communicates via JSON status files.

## Agents

### 1. Team Lead Agent
**File:** `backend/agents/team_lead_agent.py`  
**Model:** claude-sonnet-4-20250514 (decisions) + claude-haiku-4-5-20251001 (status updates)

**Responsibilities:**
- Reads `information/tasks/v1-tasks.md` at startup
- Assigns tasks to the appropriate agent based on task type
- Tracks progress in `information/tasks/v1-progress.md`
- Updates `information/tasks/v1-changelog.md` after task completion
- Never writes application code — coordination only

**Does NOT:**
- Write frontend or backend code
- Make deployment decisions without consulting DevOps Agent
- Skip task order in the execution plan

---

### 2. Frontend Agent
**File:** `frontend/src/agents/frontend-agent.ts`  
**Model:** claude-haiku-4-5-20251001 (boilerplate) + claude-sonnet-4-20250514 (complex logic)

**Responsibilities:**
- All React, TypeScript, TailwindCSS, shadcn/ui work
- State management (Zustand stores)
- API service layer (Axios)
- Page components and routing

**Scope:** `frontend/` directory only

**Uses Haiku for:**
- Component boilerplate (types, interfaces, simple components)
- Zustand store scaffolding
- Axios service function stubs
- TypeScript type definitions

**Uses Sonnet for:**
- Complex state/hooks logic
- Multi-step form flows
- Dashboard with data fetching
- Calendar component
- AI Plan Generator UI

---

### 3. Backend Agent
**File:** `backend/agents/backend_agent.py`  
**Model:** claude-haiku-4-5-20251001 (scaffolding) + claude-sonnet-4-20250514 (complex services)

**Responsibilities:**
- FastAPI application setup
- SQLAlchemy models and Alembic migrations
- Pydantic v2 schemas
- CRUD routers
- Platform API integrations (Instagram, TikTok, Telegram)
- Claude AI service integration
- Celery task queue

**Scope:** `backend/` directory only

**Uses Haiku for:**
- Model definitions (SQLAlchemy)
- Schema definitions (Pydantic)
- Basic CRUD routers
- Auth endpoints (register/login)
- Analytics endpoints
- File upload handler

**Uses Sonnet for:**
- Celery task design
- Redis integration
- Instagram Graph API
- TikTok Content Posting API
- Telegram Bot API
- Claude AI integration
- Security-critical code (JWT, encryption)

---

### 4. DevOps Agent
**File:** `devops/agents/devops_agent.py`  
**Model:** claude-haiku-4-5-20251001 (config files) + claude-sonnet-4-20250514 (complex scripts)

**Responsibilities:**
- VPS setup scripts
- Nginx configuration
- systemd service definitions
- Deploy scripts with rollback
- Backup automation
- GitHub push + tagging

**Scope:** `devops/` directory only

**Uses Haiku for:**
- Nginx config files
- systemd unit files
- Backup scripts
- .gitignore generation

**Uses Sonnet for:**
- Full VPS setup script (setup_vps.sh)
- Deploy script with rollback logic

---

## Task Routing Rules

```
IF task involves: React, TypeScript, CSS, shadcn, Zustand, hooks, pages
  → Frontend Agent

IF task involves: FastAPI, SQLAlchemy, Pydantic, Celery, Redis, PostgreSQL, platform APIs, auth
  → Backend Agent

IF task involves: Nginx, systemd, SSH, shell scripts, deployment, GitHub
  → DevOps Agent

IF task involves: documentation, planning, coordination
  → Team Lead Agent (Haiku)
```

## Agent Communication Protocol

Each agent writes a JSON status file to `information/tasks/status/` after completing a task:

```json
{
  "agent": "frontend-agent",
  "task_id": "FE-001",
  "status": "completed",
  "files_changed": [
    "frontend/src/components/dashboard/StatsCard.tsx",
    "frontend/package.json"
  ],
  "notes": "Setup complete. Vite + React + TS + Tailwind + shadcn.",
  "timestamp": "2025-05-11T18:00:00Z"
}
```

**Status values:** `pending` | `in_progress` | `completed` | `failed` | `blocked`

If `status` is `failed` or `blocked`, the agent also sets:
```json
{
  "error": "Description of what went wrong",
  "blocker": "Depends on BE-001 which is not complete"
}
```

Team Lead reads all status files every 30 seconds and updates `v1-progress.md`.

## Model Selection Summary

| Task Type | Model |
|-----------|-------|
| Documentation, markdown | claude-haiku-4-5-20251001 |
| Boilerplate (models, schemas, types) | claude-haiku-4-5-20251001 |
| Simple CRUD, auth forms | claude-haiku-4-5-20251001 |
| Shell scripts | claude-haiku-4-5-20251001 |
| Config files (nginx, systemd) | claude-haiku-4-5-20251001 |
| Complex architecture design | claude-sonnet-4-20250514 |
| Platform API integrations | claude-sonnet-4-20250514 |
| Celery + async task design | claude-sonnet-4-20250514 |
| AI service integration | claude-sonnet-4-20250514 |
| Security code (JWT, encryption) | claude-sonnet-4-20250514 |
| Complex UI (calendar, dashboard) | claude-sonnet-4-20250514 |
| Deploy scripts with rollback | claude-sonnet-4-20250514 |
| Code review | claude-sonnet-4-20250514 |
