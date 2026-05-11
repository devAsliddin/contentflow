# ContentFlow — System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ContentFlow V1                                │
│                                                                     │
│  ┌──────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│  │  Browser │────▶│  Nginx      │────▶│  React (Vite)          │  │
│  │  Client  │     │  :80 / :443 │     │  :5173 (served static) │  │
│  └──────────┘     └──────┬──────┘     └─────────────────────────┘  │
│                          │ /api/*                                   │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │  FastAPI      │                                  │
│                  │  Uvicorn :8000│                                  │
│                  └──┬────────┬──┘                                  │
│                     │        │                                      │
│            ┌────────┘        └────────┐                            │
│            ▼                          ▼                             │
│    ┌──────────────┐         ┌──────────────────┐                   │
│    │ PostgreSQL   │         │  Redis           │                   │
│    │ :5432        │         │  :6379           │                   │
│    └──────────────┘         └────────┬─────────┘                  │
│                                      │                              │
│                              ┌───────┴──────┐                      │
│                              │ Celery Worker│                      │
│                              │ (systemd)    │                      │
│                              └──────┬───────┘                      │
│                                     │ publish jobs                 │
│                    ┌────────────────┼────────────────┐             │
│                    ▼                ▼                 ▼             │
│           ┌─────────────┐  ┌──────────────┐  ┌────────────┐       │
│           │ Telegram    │  │ Instagram    │  │ TikTok     │       │
│           │ Bot API     │  │ Graph API    │  │ Content API│       │
│           └─────────────┘  └──────────────┘  └────────────┘       │
│                                                                     │
│                    ┌────────────────────┐                          │
│                    │ Anthropic Claude   │                          │
│                    │ (AI Plan + Caption)│                          │
│                    └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 18.x |
| Frontend Language | TypeScript | 5.x |
| Frontend Build | Vite | 5.x |
| CSS Framework | TailwindCSS | 3.x |
| UI Components | shadcn/ui | latest |
| State Management | Zustand | 4.x |
| Data Fetching | TanStack Query | 5.x |
| HTTP Client | Axios | 1.x |
| Router | React Router | 6.x |
| Charts | Recharts | 2.x |
| Backend Framework | FastAPI | 0.110.x |
| Backend Language | Python | 3.11 |
| ORM | SQLAlchemy (async) | 2.x |
| Migrations | Alembic | 1.13.x |
| Task Queue | Celery | 5.x |
| Cache/Broker | Redis | 7.x |
| Database | PostgreSQL | 15.x |
| AI | Anthropic Claude API | claude-sonnet-4-20250514 / claude-haiku-4-5-20251001 |
| Auth | JWT (python-jose) | 3.x |
| Password Hash | bcrypt | 4.x |
| Web Server | Uvicorn | 0.29.x |
| Reverse Proxy | Nginx | 1.24.x |
| Process Manager | systemd | — |

## Database Schema

### users
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
hashed_password VARCHAR(255) NOT NULL
full_name       VARCHAR(255)
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### accounts
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
platform        VARCHAR(50) NOT NULL  -- 'instagram' | 'tiktok' | 'telegram'
account_name    VARCHAR(255) NOT NULL
credentials     TEXT NOT NULL  -- encrypted JSON
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()

CONSTRAINT uq_user_platform_account UNIQUE (user_id, platform, account_name)
```

### posts
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
caption         TEXT
media_url       VARCHAR(500)
media_type      VARCHAR(20)  -- 'image' | 'video'
platforms       JSONB        -- ["instagram:acc_id", "telegram:acc_id"]
scheduled_at    TIMESTAMPTZ
status          VARCHAR(20) DEFAULT 'draft'  -- draft|scheduled|publishing|published|failed
celery_task_id  VARCHAR(255)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### post_logs
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
post_id         UUID REFERENCES posts(id) ON DELETE CASCADE
platform        VARCHAR(50)
account_id      UUID REFERENCES accounts(id)
status          VARCHAR(20)  -- success | failed
external_id     VARCHAR(255)  -- platform's post ID
error_message   TEXT
executed_at     TIMESTAMPTZ DEFAULT now()
```

### Relationships
- User → Accounts (1:many, max 3 per platform)
- User → Posts (1:many)
- Post → PostLogs (1:many, one per platform execution)

## API Design Principles

1. **RESTful** — standard HTTP methods, plural nouns
2. **JWT Auth** — Bearer token on all protected routes
3. **Async** — all endpoints use async/await, async SQLAlchemy
4. **Pagination** — list endpoints accept `skip` + `limit`
5. **Validation** — Pydantic v2 schemas on all inputs/outputs
6. **Versioning** — all routes prefixed with `/api/v1`
7. **Error format** — `{"detail": "error message"}` for all errors

## Agent System

See `information/agent-system.md` for full agent system documentation.

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string (asyncpg) |
| REDIS_URL | Redis connection string |
| SECRET_KEY | JWT signing secret (min 32 chars) |
| ACCESS_TOKEN_EXPIRE_MINUTES | Access token TTL (default: 30) |
| REFRESH_TOKEN_EXPIRE_DAYS | Refresh token TTL (default: 7) |
| ANTHROPIC_API_KEY | Anthropic API key for Claude |
| INSTAGRAM_APP_ID | Instagram Graph API app ID |
| INSTAGRAM_APP_SECRET | Instagram Graph API app secret |
| TIKTOK_CLIENT_KEY | TikTok Content Posting API key |
| TIKTOK_CLIENT_SECRET | TikTok Content Posting API secret |
| TELEGRAM_BOT_TOKEN | Telegram Bot API token |
| ENVIRONMENT | development / production |
| FRONTEND_URL | Frontend origin for CORS |
| BACKEND_URL | Backend public URL |
| MEDIA_DIR | Local path for uploaded media |
