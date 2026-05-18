# ContentFlow — Full Project Summary

> Version: 2.0.0 | Status: Production-Ready | Date: 2026-05-18

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Agent System — Who Built What](#agent-system--who-built-what)
3. [Full Architecture](#full-architecture)
4. [Tech Stack](#tech-stack)
5. [Feature Breakdown](#feature-breakdown)
6. [Database Schema](#database-schema)
7. [API Reference Summary](#api-reference-summary)
8. [Deployment Options](#deployment-options)
9. [Directory Structure](#directory-structure)
10. [Version History](#version-history)

---

## Project Overview

**ContentFlow** is a production-ready, multi-platform social media content scheduler and AI assistant. It allows users to plan, create, schedule, and analyze content across Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, and Twitter/X — all from a single dashboard.

**Core capabilities:**
- Schedule posts to multiple social platforms simultaneously
- AI-powered caption generation, content planning, and hashtag suggestions
- Drag-and-drop content calendar with monthly view
- Analytics dashboard with follower growth tracking
- Content approval workflow (draft → review → publish)
- Caption template library and post recycling
- Telegram bot notifications for publish events
- Docker + systemd deployment options

**GitHub:** [https://github.com/devAsliddin/contentflow](https://github.com/devAsliddin/contentflow)

---

## Agent System — Who Built What

ContentFlow was built using a **multi-agent AI coordination system** — four specialized AI agents worked in parallel, each owning a specific domain of the project. A Team Lead agent coordinated all tasks, tracked progress, and resolved inter-agent dependencies.

```
                         ┌─────────────────────┐
                         │    Team Lead Agent   │
                         │  (Coordinator/PM)    │
                         │  - claude-sonnet-4   │
                         └──────────┬──────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐   ┌─────────▼──────────┐  ┌────────▼────────┐
   │ Frontend Agent  │   │   Backend Agent     │  │  DevOps Agent   │
   │  (React/TS)     │   │  (FastAPI/Python)   │  │ (Infra/Deploy)  │
   └─────────────────┘   └────────────────────┘  └─────────────────┘
```

---

### Team Lead Agent

**Role:** Project manager, never writes application code  
**Responsibilities:**
- Created and tracked all V1 and V2 task lists (`/information/tasks/`)
- Assigned tasks to Frontend, Backend, and DevOps agents
- Monitored progress via JSON status files in `/information/tasks/status/`
- Resolved cross-agent dependencies (e.g., API contracts between frontend and backend)
- Maintained `v2-progress.md` as single source of truth for completion status
- Made architecture decisions (when to use Celery vs cron, JWT vs session, etc.)

**Files owned:**
```
information/tasks/v1/          — V1 task planning and tracking
information/tasks/v2/          — V2 task planning (31 tasks, all complete)
information/tasks/status/      — Inter-agent communication JSON files
information/agent-system.md    — Agent coordination documentation
information/agents-documentation.md  — Agent roles (Uzbek)
```

---

### Backend Agent

**Role:** All FastAPI, database, and third-party integration work  
**Responsibilities:**
- Designed and implemented the full FastAPI application structure
- Built all SQLAlchemy ORM models and Alembic migrations
- Implemented JWT authentication (access + refresh tokens)
- Integrated 7 social platform APIs (Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, Twitter/X)
- Built OAuth2 flows for Instagram and TikTok
- Integrated Anthropic Claude API for AI features
- Added Ollama local LLM support as fallback
- Implemented Celery task queue for async post publishing
- Built analytics endpoints with Redis caching
- Created post approval workflow logic
- Added follower snapshot system for trend tracking
- Implemented credential encryption (Fernet)
- Built admin panel endpoints
- Fixed Ollama/OpenRouter fallback logic (502 errors)
- Added image-based caption generation via Ollama vision

**Files owned:**
```
backend/app/main.py            — FastAPI app entry, middleware, lifespan
backend/app/config.py          — Pydantic settings (env-based config)
backend/app/database.py        — Async PostgreSQL engine + session factory
backend/app/redis_client.py    — Redis client initialization
backend/app/models/            — SQLAlchemy ORM models (users, posts, accounts, etc.)
backend/app/schemas/           — Pydantic v2 request/response schemas
backend/app/routers/           — All API route handlers (15+ routers)
backend/app/services/          — Business logic and platform integrations
backend/app/tasks/             — Celery tasks (publish, beat scheduler)
backend/agents/                — AI agent coordinator logic
backend/alembic/               — Database migration scripts
backend/requirements.txt       — Python dependencies
```

**Key technical decisions:**
- Chose **async SQLAlchemy + asyncpg** for non-blocking DB queries
- Used **Pydantic v2** for stricter validation and better performance
- Used **Fernet symmetric encryption** for platform credentials in DB
- Structured routers by feature, not by HTTP method
- Used **Redis TTL cache** (1 hour) for analytics queries

---

### Frontend Agent

**Role:** All React/TypeScript/CSS work  
**Responsibilities:**
- Bootstrapped Vite + React 18 + TypeScript project
- Implemented all 15 pages (landing, auth, dashboard, calendar, analytics, AI chat, etc.)
- Built the full sidebar navigation with multi-account switcher
- Integrated Zustand for global state (auth, UI theme, post creation)
- Integrated TanStack Query for server state and caching
- Built drag-and-drop content calendar with monthly view
- Created AI chat interface with streaming support
- Built analytics dashboard with Recharts visualizations
- Implemented file upload (drag-and-drop, bulk, progress tracking)
- Added dark mode toggle (persisted to localStorage)
- Made all pages mobile-responsive (375px+)
- Built approval workflow UI (draft → pending review → approved)
- Created template library management UI
- Implemented post recycling/reposting interface
- Connected all API services with proper error handling and toast notifications

**Files owned:**
```
frontend/src/App.tsx           — Root component, React Router setup
frontend/src/pages/            — 15 page components
frontend/src/components/       — Reusable UI components (layout, dashboard, posts, calendar, AI)
frontend/src/services/         — Axios-based API service layer
frontend/src/store/            — Zustand stores (auth, UI, posts)
frontend/src/types/            — TypeScript interfaces and type definitions
frontend/src/hooks/            — Custom React hooks
frontend/src/utils/            — Utility functions
frontend/vite.config.ts        — Vite config with API proxy
frontend/tailwind.config.js    — TailwindCSS config with custom theme
frontend/tsconfig.json         — TypeScript strict config
frontend/package.json          — NPM dependencies
```

**Key technical decisions:**
- Used **Zustand** (not Redux) for lightweight global state — avoids boilerplate
- Used **TanStack Query** for server state — automatic refetching, cache invalidation
- Used **shadcn/ui** for accessible, unstyled primitives with custom Tailwind styling
- Chose **Recharts** for analytics — React-native, composable, performant
- Used **sonner** for toast notifications — minimal bundle, good UX

---

### DevOps Agent

**Role:** Infrastructure, deployment scripts, containerization, CI/CD  
**Responsibilities:**
- Wrote Nginx reverse proxy configurations (VPS + Docker variants)
- Created systemd service definitions for all 4 services
- Built automated VPS setup script (`setup_vps.sh`) — installs all deps, configures firewall
- Built deploy script with automatic rollback on failure
- Created Docker images for backend and frontend
- Wrote `docker-compose.yml` for full 7-service orchestration
- Added Makefile for common dev commands
- Set up GitHub Actions CI/CD pipeline (`.github/workflows/`)
- Added `.dockerignore` and `.env.example` files
- Created CDN-optimized Nginx config for media serving
- Built SSH-based remote deployment workflow
- Added PostgreSQL backup automation scripts
- Created `docker-logs.sh` and `docker-deploy.sh` utilities

**Files owned:**
```
devops/scripts/                — All deployment and utility shell scripts
devops/nginx/                  — All Nginx configuration variants
devops/systemd/                — systemd service unit files
devops/README.md               — DevOps setup and usage guide
Dockerfile.backend             — Python 3.11 multi-stage build
Dockerfile.frontend            — Node 20 + Nginx production image
docker-compose.yml             — 7-service orchestration
.github/workflows/             — GitHub Actions CI/CD pipelines
Makefile                       — Developer convenience commands
.dockerignore                  — Docker build exclusion list
.env.example                   — Root-level environment template
```

**Key technical decisions:**
- Multi-stage Docker builds to minimize image sizes
- Nginx serves frontend static files directly (no Node.js in production)
- Celery and Celery Beat run as separate containers for independent scaling
- Used `depends_on` with health checks for proper startup ordering
- SSH-based remote deploy (no Docker Hub required for private repos)

---

## Full Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│                   React 18 SPA (TypeScript)                     │
│           TanStack Query + Zustand + React Router               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX REVERSE PROXY                      │
│  /           → serve /frontend/dist (static files)             │
│  /api/*      → proxy to FastAPI :8000                          │
│  /media/*    → serve uploaded files with CDN headers           │
│  SSL termination, gzip compression, rate limiting               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
┌─────────────────┐         ┌──────────────────────────────────┐
│  Static Files   │         │       FastAPI Backend             │
│  (Nginx serve)  │         │      Python 3.11 / Uvicorn        │
│  /dist/index.html          │  JWT Auth + Pydantic v2 + SQLAlch │
│  /dist/assets/  │         │  15+ routers, async handlers      │
└─────────────────┘         └──────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
          ┌──────────────┐   ┌──────────────────┐  ┌───────────────┐
          │  PostgreSQL  │   │      Redis       │  │  Media Files  │
          │   (asyncpg)  │   │  Cache + Broker  │  │  /media/ dir  │
          │  6 tables    │   │  Celery queues   │  │  (images, vid)│
          └──────────────┘   └────────┬─────────┘  └───────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                          ▼                       ▼
              ┌─────────────────┐    ┌────────────────────┐
              │  Celery Worker  │    │  Celery Beat       │
              │  (post publish) │    │  (cron scheduler)  │
              │  async tasks    │    │  periodic tasks    │
              └────────┬────────┘    └────────────────────┘
                       │
         ┌─────────────┼────────────────────────────────┐
         │             │             │                  │
         ▼             ▼             ▼                  ▼
  ┌──────────┐ ┌────────────┐ ┌──────────┐    ┌───────────────┐
  │ Instagram│ │  TikTok    │ │ Telegram │    │  Anthropic    │
  │ Graph API│ │ Content API│ │  Bot API │    │  Claude API   │
  └──────────┘ └────────────┘ └──────────┘    └───────────────┘
  ┌──────────┐ ┌────────────┐ ┌──────────┐    ┌───────────────┐
  │ Facebook │ │  LinkedIn  │ │ YouTube  │    │  Ollama       │
  │ Graph API│ │    API     │ │   API    │    │  (local LLM)  │
  └──────────┘ └────────────┘ └──────────┘    └───────────────┘
```

### Request Lifecycle (Post Scheduling)

```
User clicks "Schedule Post"
        │
        ▼
React (TanStack Query mutation)
        │  POST /api/v1/posts  {caption, media_ids, platforms, scheduled_at}
        ▼
FastAPI /routers/posts.py
        │  Validates request (Pydantic v2)
        │  Stores post in PostgreSQL (status: "scheduled")
        │  Enqueues Celery task with ETA = scheduled_at
        ▼
Response 201 → UI shows "Scheduled"
        │
        ▼ (at scheduled_at time)
Celery Beat triggers task
        │
        ▼
celery_app.tasks.post_tasks.publish_post()
        │  For each platform in post.platforms:
        │    Load account credentials (decrypt Fernet)
        │    Call platform service (instagram/tiktok/telegram/etc.)
        │    Update post_logs (status: published, external_id)
        │  Update post.status = "published"
        │  Send Telegram notification
        ▼
Post live on all selected platforms
```

### AI Caption Generation Lifecycle

```
User requests caption generation
        │
        ▼
FastAPI /routers/ai_v2.py
        │  Check: is Ollama available locally?
        │    YES → use Ollama (local, free)
        │    NO  → use Anthropic Claude API
        │          (fallback: OpenRouter)
        ▼
Construct platform-specific prompt
(Instagram: hashtags, emojis, casual
 LinkedIn: professional, no emoji
 TikTok: trends, Gen-Z tone)
        │
        ▼
Stream response back to client
        │
        ▼
Frontend renders caption in editor
User can regenerate or edit before posting
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool, dev server |
| TailwindCSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Accessible UI primitives |
| Zustand | 4.x | Global state management |
| TanStack Query | 5.x | Server state, caching |
| React Router | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Recharts | 2.x | Charts and visualizations |
| date-fns | 3.x | Date manipulation |
| sonner | latest | Toast notifications |
| react-dropzone | latest | File upload UX |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.110.x | Web framework |
| Python | 3.11 | Runtime |
| SQLAlchemy | 2.x | ORM (async) |
| asyncpg | latest | PostgreSQL async driver |
| Alembic | 1.13.x | Database migrations |
| Pydantic | v2 | Data validation |
| Celery | 5.x | Task queue |
| Redis | 7.x | Cache + Celery broker |
| python-jose | latest | JWT tokens |
| bcrypt | latest | Password hashing |
| cryptography | latest | Fernet credential encryption |
| Anthropic SDK | latest | Claude AI integration |
| httpx | latest | Async HTTP client |
| aiofiles | latest | Async file I/O |

### AI / LLM
| Service | Purpose |
|---|---|
| Anthropic Claude (claude-sonnet-4-20250514) | Primary AI — complex content planning |
| Anthropic Claude (claude-haiku-4-5-20251001) | Secondary AI — fast caption generation |
| Ollama (local) | Local LLM fallback — no API cost |
| Ollama Vision (llava) | Image-based caption generation |
| OpenRouter | Third fallback if Anthropic unavailable |

### Infrastructure
| Technology | Purpose |
|---|---|
| Nginx 1.24 | Reverse proxy, static file serving, SSL |
| Docker + Docker Compose | Containerization, service orchestration |
| PostgreSQL 15 | Primary relational database |
| Redis 7 | Celery broker, analytics cache |
| systemd | Native VPS process management |
| Let's Encrypt + Certbot | Free SSL/TLS certificates |
| UFW | Host-level firewall |
| fail2ban | DDoS / brute-force protection |
| GitHub Actions | CI/CD pipeline |

---

## Feature Breakdown

### Authentication & Security
- JWT access tokens (15 min expiry) + refresh tokens (7 day expiry)
- bcrypt password hashing with salt
- Fernet symmetric encryption for stored platform credentials
- OAuth2 PKCE flow for Instagram and TikTok
- Role-based access control (user / admin)

### Social Account Management
- Connect multiple accounts per platform (max 3)
- Supported platforms: Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, Twitter/X
- Encrypted credential storage
- Account status management (active / inactive / error)
- Verify account connectivity

### Content Creation & Scheduling
- Rich post editor with caption, hashtags, platform selection
- Multi-file upload (image + video, up to 10 files per post)
- Schedule to multiple platforms in one action
- Draft management
- Post approval workflow (draft → pending_review → approved → published)
- Caption template library (save and reuse)
- Post recycling (reschedule previously published posts)
- Real-time status tracking (scheduling → publishing → published / failed)
- Celery-based async publishing with automatic retry

### AI Features
| Feature | Endpoint | Description |
|---|---|---|
| Caption Generator | `POST /ai/generate-caption` | Platform-optimized captions |
| Caption Rewriter | `POST /ai/rewrite-caption` | Rewrite with tone adjustment |
| A/B Variants | `POST /ai/ab-captions` | 3 caption variants for A/B testing |
| Hashtag Suggester | `POST /ai/hashtags` | Trending + niche hashtag recommendations |
| Tone Analyzer | `POST /ai/analyze-tone` | Score: professional / casual / fun |
| Content Plan | `POST /ai/generate-plan` | Weekly content calendar with timing |
| AI Chat | `POST /ai/chat` | Interactive content ideas assistant |
| Vision Captions | `POST /ai/vision-caption` | Image → caption via Ollama vision |

### Analytics
- Post performance: likes, views, reach, comments per post
- Platform comparison charts
- Follower growth over time (snapshot-based)
- Best posting time heatmap
- Weekly auto PDF report generation
- Redis-cached analytics (1-hour TTL)

### Calendar & Scheduling
- Monthly calendar view with all scheduled posts
- Drag-and-drop rescheduling
- Visual platform color coding
- Upcoming posts widget on dashboard

### Notifications
- Telegram bot: post published successfully
- Telegram bot: post failed (with error details)
- Telegram bot: weekly analytics summary
- In-app toast notifications (sonner)
- Admin panel for system monitoring

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR UNIQUE NOT NULL,
    full_name   VARCHAR,
    password_hash VARCHAR NOT NULL,
    role        VARCHAR DEFAULT 'user',  -- 'user' | 'admin'
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Connected Social Accounts
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    platform        VARCHAR NOT NULL,   -- 'instagram' | 'tiktok' | 'telegram' | ...
    username        VARCHAR,
    credentials     TEXT NOT NULL,      -- Fernet-encrypted JSON
    status          VARCHAR DEFAULT 'active',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Posts
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    caption         TEXT,
    media_urls      JSONB DEFAULT '[]',
    platforms       JSONB DEFAULT '[]',  -- ['instagram', 'telegram', ...]
    status          VARCHAR DEFAULT 'draft',  -- draft|pending_review|approved|scheduled|publishing|published|failed
    scheduled_at    TIMESTAMP WITH TIME ZONE,
    published_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Per-Platform Publish Logs
CREATE TABLE post_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
    platform        VARCHAR NOT NULL,
    status          VARCHAR,    -- 'success' | 'failed'
    external_id     VARCHAR,    -- platform's post ID
    error_message   TEXT,
    published_at    TIMESTAMP WITH TIME ZONE
);

-- Caption Templates
CREATE TABLE post_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR NOT NULL,
    content     TEXT NOT NULL,
    platforms   JSONB DEFAULT '[]',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Follower Growth Snapshots
CREATE TABLE follower_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID REFERENCES accounts(id) ON DELETE CASCADE,
    follower_count  INTEGER NOT NULL,
    snapshot_date   DATE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## API Reference Summary

**Base URL:** `https://yourdomain.com/api/v1`

### Auth
```
POST /auth/register          — Register new user
POST /auth/login             — Login, get JWT tokens
POST /auth/refresh           — Refresh access token
GET  /auth/me                — Current user profile
```

### Posts
```
POST   /posts                — Create post (draft or scheduled)
GET    /posts                — List posts (filter by status, platform, date)
GET    /posts/{id}           — Get single post with logs
PUT    /posts/{id}           — Update post (if not yet published)
DELETE /posts/{id}           — Delete post
POST   /posts/{id}/recycle   — Reschedule published post
```

### Accounts
```
POST   /accounts             — Connect social account
GET    /accounts             — List connected accounts
DELETE /accounts/{id}        — Disconnect account
POST   /accounts/{id}/verify — Test account connectivity
```

### AI
```
POST /ai/generate-plan       — Weekly content plan
POST /ai/generate-caption    — Platform-optimized caption
POST /ai/rewrite-caption     — Rewrite with tone
POST /ai/ab-captions         — 3 A/B variant captions
POST /ai/hashtags            — Hashtag suggestions
POST /ai/analyze-tone        — Tone analysis
POST /ai/chat                — AI chat for content ideas
POST /ai/vision-caption      — Image → caption (Ollama)
```

### Analytics
```
GET  /analytics/overview     — Weekly stats summary
GET  /analytics/by-platform  — Performance per platform
GET  /analytics/posts        — Individual post analytics
GET  /analytics/followers    — Follower growth chart
GET  /analytics/best-time    — Best posting time heatmap
POST /analytics/report       — Generate weekly PDF report
```

### Upload
```
POST /upload/media           — Single file upload
POST /upload/bulk            — Bulk upload (up to 10 files)
```

### OAuth
```
GET  /oauth/instagram/authorize   — Start Instagram OAuth flow
GET  /oauth/instagram/callback    — Instagram OAuth callback
GET  /oauth/tiktok/authorize      — Start TikTok OAuth flow
GET  /oauth/tiktok/callback       — TikTok OAuth callback
```

### Workflows
```
GET  /workflows              — List posts in approval queue
PUT  /workflows/{id}         — Update workflow state
POST /workflows/{id}/approve — Approve post for publishing
POST /workflows/{id}/reject  — Reject with feedback
```

### Admin
```
GET /admin/users             — List all users
GET /admin/posts             — All posts across users
GET /admin/stats             — System-wide stats
```

### Health
```
GET /health                  — Service health check (no auth)
```

---

## Deployment Options

### Option A: Docker Compose (Recommended)

7 containers managed by Docker Compose:

```yaml
services:
  nginx       — Reverse proxy + static file server
  frontend    — React production build (served by Nginx)
  backend     — FastAPI app (uvicorn)
  celery      — Celery worker (post publishing)
  celery-beat — Celery scheduler (cron jobs)
  postgres    — PostgreSQL 15 database
  redis       — Redis 7 cache + broker
```

**Quick start:**
```bash
cp .env.example .env          # Configure environment
docker compose up -d          # Start all services
docker compose exec backend alembic upgrade head  # Run migrations
```

### Option B: Native VPS (systemd + Nginx)

4 systemd services:

```
contentflow-backend.service      — FastAPI via Uvicorn
contentflow-celery.service       — Celery worker
contentflow-celery-beat.service  — Celery Beat scheduler
contentflow-frontend.service     — Nginx static server
```

**Quick start:**
```bash
bash devops/scripts/setup_vps.sh   # One-time server setup
bash devops/scripts/deploy.sh      # Deploy latest code
```

---

## Directory Structure

```
contentflow/
├── backend/                   FastAPI application
│   ├── app/
│   │   ├── main.py            App entry point, middleware, lifespan
│   │   ├── config.py          Pydantic settings (reads from .env)
│   │   ├── database.py        Async PostgreSQL connection
│   │   ├── redis_client.py    Redis client
│   │   ├── models/            SQLAlchemy ORM models (6 tables)
│   │   ├── schemas/           Pydantic v2 request/response schemas
│   │   ├── routers/           API route handlers (15+ routers)
│   │   ├── services/          Platform integrations + AI service
│   │   └── tasks/             Celery tasks + beat scheduler
│   ├── alembic/               Database migration scripts
│   ├── tests/                 Unit tests
│   └── requirements.txt       Python dependencies
│
├── frontend/                  React TypeScript SPA
│   ├── src/
│   │   ├── App.tsx            Root component + routing
│   │   ├── pages/             15 page components
│   │   ├── components/        Reusable UI components
│   │   ├── services/          API client layer (Axios)
│   │   ├── store/             Zustand stores
│   │   ├── types/             TypeScript interfaces
│   │   └── hooks/             Custom React hooks
│   ├── vite.config.ts         Build config + dev proxy
│   └── package.json           NPM dependencies
│
├── devops/                    Infrastructure & deployment
│   ├── scripts/               Shell scripts (setup, deploy, backup)
│   ├── nginx/                 Nginx config variants
│   ├── systemd/               systemd service unit files
│   └── README.md              DevOps documentation
│
├── information/               Project documentation
│   ├── SUMMARY.md             This file — full project summary
│   ├── architecture.md        Detailed architecture diagrams
│   ├── api-reference.md       Complete API documentation
│   ├── setup-guide.md         Local dev + VPS setup guide
│   ├── agent-system.md        Multi-agent coordination docs
│   └── tasks/                 V1 and V2 task tracking
│
├── Dockerfile.backend         Python 3.11 multi-stage image
├── Dockerfile.frontend        Node 20 + Nginx production image
├── docker-compose.yml         7-service orchestration
├── Makefile                   Developer convenience commands
├── .env.example               Environment variable template
└── .github/workflows/         GitHub Actions CI/CD
```

---

## Version History

### V1 — Core MVP
- Basic post creation and scheduling
- Instagram and Telegram integration
- JWT authentication
- Simple dashboard
- Celery task queue setup

### V2 — Full Feature Set (31 tasks completed)
1. Multi-platform support (TikTok, Facebook, LinkedIn, YouTube, Twitter)
2. OAuth2 flows for Instagram and TikTok
3. Content approval workflow
4. Caption template library
5. Post recycling / reposting
6. AI caption generation (Claude API)
7. AI content planning with weekly planner
8. Hashtag suggester
9. Post tone analyzer
10. A/B caption variants
11. AI chat interface
12. Ollama local LLM integration (free fallback)
13. Ollama vision — image-based captions
14. Analytics v2 with follower growth tracking
15. Best posting time analysis
16. Weekly PDF report generation
17. Telegram bot notifications (success + error)
18. Redis analytics caching (1-hour TTL)
19. Drag-and-drop content calendar
20. Dark mode toggle
21. Mobile-responsive design (375px+)
22. Admin panel
23. Bulk media upload (10 files)
24. PostgreSQL query optimization (indexes)
25. Docker containerization
26. Docker Compose 7-service orchestration
27. Multi-stage Docker builds
28. CI/CD pipeline (GitHub Actions)
29. SSH-based remote deployment
30. Automated PostgreSQL backups
31. CDN media serving + Nginx optimization

---

*Built with the multi-agent AI coordination system using Claude Sonnet 4 and Claude Haiku.*
