# ContentFlow — Developer Documentation

> GitHub: [https://github.com/devAsliddin/contentflow](https://github.com/devAsliddin/contentflow)

---

## Loyiha haqida

**ContentFlow** — ko'p platformali kontent rejalashtirish va avtomatik nashr qilish tizimi (SMM SaaS).  
Foydalanuvchilar Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, Twitter kabi ijtimoiy tarmoqlarga kontent rejalashtirib, AI yordamida g'oyalar va sarlavhalar olishlari mumkin.

---

## Tech Stack — To'liq Tavsif

### Backend

| Texnologiya | Versiya | Nima uchun ishlatilgan |
|---|---|---|
| **Python** | 3.11+ | Asosiy backend tili. `asyncio` native qo'llab-quvvatlashi, type hints va Pydantic integratsiyasi uchun |
| **FastAPI** | ≥0.110 | Async REST API framework. Pydantic v2 bilan native integratsiya, avtomatik OpenAPI docs, dependency injection tizimi |
| **SQLAlchemy** | ≥2.0 (async) | ORM. `asyncpg` orqali to'liq async DB operatsiyalari, Alembic bilan migration tizimi |
| **Alembic** | ≥1.13 | DB migration boshqaruvi. Version-controlled schema o'zgarishlari |
| **PostgreSQL** | 15+ | Asosiy ma'lumotlar bazasi. UUID primary keylar, JSONB (credentials), async driver |
| **asyncpg** | ≥0.29 | PostgreSQL uchun eng tezkor async Python driver |
| **Redis** | 7+ | Celery broker va result backend. Task queue, caching |
| **Celery** | ≥5.3 | Async task queue. Rejalashtirilgan postlarni background'da yuborish, beat scheduler |
| **Pydantic v2** | ≥2.7 | Request/response validation, settings management. v2 — v1 dan 10x tezroq |
| **pydantic-settings** | ≥2.2 | `.env` faylidan konfiguratsiya yuklash |
| **python-jose** | ≥3.3 | JWT token yaratish va tekshirish (HS256 algoritm) |
| **passlib + bcrypt** | ≥1.7 / 4.0 | Parol hashing. bcrypt — brute force ga chidamli |
| **slowapi** | ≥0.1.9 | Rate limiting. Login/register endpointlarini brute force'dan himoya qilish |
| **cryptography (Fernet)** | ≥42.0 | Platform credentials (token, secret)larni shifrlash |
| **httpx** | ≥0.27 | Async HTTP client. Platform API'lariga so'rovlar uchun |
| **aiofiles** | ≥23.2 | Async fayl I/O. Media fayllarni async yozish/o'qish |
| **python-multipart** | ≥0.0.9 | Multipart form-data (fayl yuklash) uchun |
| **anthropic** | ≥0.25 | Anthropic Claude API client |
| **instagrapi** | ≥2.0 | Instagram private API integratsiyasi |
| **requests** | ≥2.31 | Sync HTTP (ba'zi platform integratsiyalarida) |
| **gunicorn** | ≥22.0 | Production WSGI/ASGI server (uvicorn workers bilan) |
| **uvicorn** | ≥0.29 | ASGI server, uvloop bilan |

### Frontend

| Texnologiya | Versiya | Nima uchun ishlatilgan |
|---|---|---|
| **React** | 18.2 | UI library. Concurrent rendering, Suspense |
| **TypeScript** | 5.4 | Type safety. Katta loyihalarda xatolarni kompilyatsiya vaqtida tutish |
| **Vite** | 5.2 | Build tool. HMR, ESM-native, CRA'dan 10x tez |
| **TailwindCSS** | 3.4 | Utility-first CSS. Custom design tokens (bg, surface, line, ink, faint, mute) |
| **Radix UI** | latest | Headless accessible UI primitives (Dialog, Select, Tabs, Switch, Tooltip va b.) |
| **Zustand** | 4.5 | Lightweight state management. Redux'dan soddaroq, persist middleware |
| **TanStack Query** | 5.28 | Server state management. Caching, invalidation, background refetch |
| **Axios** | 1.6 | HTTP client. Interceptor orqali token refresh avtomatik |
| **React Router DOM** | 6.22 | Client-side routing, lazy loading |
| **Recharts** | 2.12 | Analytics uchun SVG grafiklar |
| **date-fns** | 3.6 | Date manipulation (formatting, scheduling) |
| **lucide-react** | 0.363 | Icon library (SVG) |
| **sonner** | 1.4 | Toast notifications |
| **react-dropzone** | 14.2 | Drag-and-drop fayl yuklash |
| **clsx + tailwind-merge** | latest | Conditional className birlashtirish |
| **class-variance-authority** | 0.7 | Variant-based component API |

### DevOps / Infra

| Texnologiya | Nima uchun ishlatilgan |
|---|---|
| **Ubuntu 22.04** | VPS OS |
| **Nginx** | Reverse proxy, static fayl serve, SSL termination |
| **systemd** | Backend, Celery, Frontend servislarini process management |
| **fail2ban** | SSH brute force himoya |
| **UFW** | Firewall (22, 80, 443 portlar) |
| **PostgreSQL** | Ma'lumotlar bazasi (systemd servis) |
| **Redis** | Task queue broker (systemd servis) |

### AI Stack

| Texnologiya | Nima uchun ishlatilgan |
|---|---|
| **Ollama** | Local AI model server (mahalliy, API chiqimsiz) |
| **Anthropic Claude API** | Cloud AI fallback (caption, plan generation) |
| **OpenRouter** | Multi-model API gateway (GPT, Mistral va b.) |

---

## Loyiha Strukturasi

```
contentflow/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, router registration
│   │   ├── config.py            # Pydantic Settings (.env loader)
│   │   ├── database.py          # Async SQLAlchemy engine, session factory
│   │   ├── redis_client.py      # Redis connection
│   │   ├── models/              # SQLAlchemy ORM modellari
│   │   │   ├── user.py
│   │   │   ├── post.py
│   │   │   ├── account.py
│   │   │   ├── post_template.py
│   │   │   └── follower_snapshot.py
│   │   ├── schemas/             # Pydantic v2 schemalar
│   │   │   ├── user.py          # UserCreate, UserLogin, UserOut, AuthResponse
│   │   │   ├── post.py
│   │   │   ├── account.py
│   │   │   └── ai_plan.py
│   │   ├── routers/             # FastAPI router'lar (endpoint'lar)
│   │   │   ├── auth.py          # /auth/register, /login, /refresh, /me
│   │   │   ├── posts.py         # CRUD posts
│   │   │   ├── accounts.py      # Social accounts
│   │   │   ├── upload.py        # Media upload
│   │   │   ├── analytics.py     # Stats
│   │   │   ├── analytics_v2.py
│   │   │   ├── ai_plan.py       # AI content plan
│   │   │   ├── ai_v2.py         # AI v2
│   │   │   ├── ai_v2_ext.py
│   │   │   ├── ai_chat.py       # AI chat
│   │   │   ├── ai_agent.py
│   │   │   ├── oauth.py         # OAuth flows
│   │   │   ├── scheduler.py     # Manual schedule trigger
│   │   │   ├── workflows.py     # Automation workflows
│   │   │   └── admin.py         # Admin panel
│   │   ├── services/            # Business logic
│   │   │   ├── ai_service.py    # Ollama + Claude integration
│   │   │   ├── instagram_service.py
│   │   │   ├── tiktok_service.py
│   │   │   ├── telegram_service.py
│   │   │   ├── facebook_service.py
│   │   │   ├── linkedin_service.py
│   │   │   ├── youtube_service.py
│   │   │   ├── twitter_service.py
│   │   │   ├── encryption.py    # Fernet credentials encryption
│   │   │   └── ollama_client.py
│   │   ├── tasks/               # Celery tasks
│   │   │   ├── celery_app.py    # Celery configuration
│   │   │   ├── post_tasks.py    # Post publishing tasks
│   │   │   ├── ai_tasks.py      # AI generation tasks
│   │   │   └── beat_tasks.py    # Periodic tasks (scheduler)
│   │   └── middleware/
│   │       └── auth_middleware.py  # JWT, bcrypt, get_current_user
│   ├── agents/                  # AI agents (development automation)
│   │   ├── team_lead_agent.py
│   │   ├── backend_agent.py
│   │   └── agent_manager.py
│   ├── alembic/                 # DB migrations
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Router setup
│   │   ├── pages/               # Sahifalar
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── NewPostPage.tsx
│   │   │   ├── AccountsPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── AiChatPage.tsx
│   │   │   ├── AiPlanPage.tsx
│   │   │   ├── CalendarPage.tsx
│   │   │   ├── DraftsPage.tsx
│   │   │   ├── TemplatesPage.tsx
│   │   │   ├── ApprovalPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── AdminPage.tsx
│   │   │   └── LandingPage.tsx
│   │   ├── components/          # UI komponentlar
│   │   │   ├── layout/          # Layout, Sidebar, TopBar
│   │   │   ├── posts/           # UploadZone, PlatformSelector, BulkUploadModal, RecycleModal
│   │   │   ├── dashboard/       # StatsCard, AiSuggestions, UpcomingPosts
│   │   │   ├── accounts/        # MigrationBanner
│   │   │   └── ui/              # Avatar, Btn, StatusPill, Sparkline, PlatformChip
│   │   ├── store/               # Zustand stores
│   │   │   ├── auth.store.ts    # User, tokens, login/register/logout
│   │   │   ├── posts.store.ts
│   │   │   ├── ui.store.ts
│   │   │   └── index.ts
│   │   ├── services/            # API layer (Axios)
│   │   │   ├── api.ts           # Axios instance + interceptors
│   │   │   ├── posts.service.ts
│   │   │   ├── accounts.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── admin.service.ts
│   │   │   └── workflows.service.ts
│   │   ├── types/               # TypeScript type definitions
│   │   │   ├── api.types.ts
│   │   │   ├── post.types.ts
│   │   │   └── account.types.ts
│   │   ├── agents/
│   │   │   └── frontend-agent.ts
│   │   └── utils/
│   │       ├── cn.ts            # clsx + tailwind-merge
│   │       ├── date.utils.ts
│   │       └── platform.utils.ts
│   └── package.json
├── devops/
│   ├── scripts/
│   │   ├── backup.sh
│   │   └── restart_services.sh
│   └── systemd/
│       └── contentflow-frontend.service
└── information/
    ├── USER_GUIDE.md
    ├── DEVELOPER_GUIDE.md
    ├── api-reference.md
    ├── setup-guide.md
    └── agent-system.md
```

---

## Agent Tizimi (AI-Driven Development)

ContentFlow loyihasi **4 ta ixtisoslashgan AI agent** yordamida qurilgan. Har bir agent aniq scope'ga ega va Claude modellari yordamida ishlaydi.

### Agent Arxitekturasi

```
Team Lead Agent (Koordinator)
    ├── Frontend Agent  (React/TS/TailwindCSS)
    ├── Backend Agent   (FastAPI/SQLAlchemy/Celery)
    └── DevOps Agent    (Nginx/systemd/deploy scripts)
```

---

### 1. Team Lead Agent

**Fayl:** `backend/agents/team_lead_agent.py`  
**Modellar:** `claude-sonnet-4-20250514` (qarorlar) + `claude-haiku-4-5-20251001` (status yangilash)

**Vazifalar:**
- `information/tasks/v1-tasks.md` ni ishga tushishda o'qiydi
- Har bir taskni mos agentga yo'naltiradi (task tipiga qarab)
- Progressni `information/tasks/v1-progress.md` da kuzatadi
- Task tugagandan so'ng `information/tasks/v1-changelog.md` ni yangilaydi
- Faqat koordinatsiya — hech qachon application code yozmaydi

**Routing qoidalari:**
```
React, TypeScript, CSS, shadcn, Zustand, hooks, sahifalar
  → Frontend Agent

FastAPI, SQLAlchemy, Pydantic, Celery, Redis, PostgreSQL, platform API, auth
  → Backend Agent

Nginx, systemd, SSH, shell scripts, deployment, GitHub
  → DevOps Agent

Documentation, planning, coordination
  → Team Lead Agent (Haiku)
```

---

### 2. Frontend Agent

**Fayl:** `frontend/src/agents/frontend-agent.ts`  
**Modellar:** `claude-haiku-4-5-20251001` (boilerplate) + `claude-sonnet-4-20250514` (murakkab logika)

**Scope:** faqat `frontend/` papkasi

**Haiku bilan ishlaydi (tez, arzon):**
- Component boilerplate (types, interfaces, oddiy komponentlar)
- Zustand store scaffolding
- Axios service function stubs
- TypeScript type definitions

**Sonnet bilan ishlaydi (murakkab):**
- Complex state / custom hooks
- Ko'p qadamli form flows
- Dashboard + data fetching
- Kalendar komponenti
- AI Plan Generator UI

---

### 3. Backend Agent

**Fayl:** `backend/agents/backend_agent.py`  
**Modellar:** `claude-haiku-4-5-20251001` (scaffolding) + `claude-sonnet-4-20250514` (murakkab servislar)

**Scope:** faqat `backend/` papkasi

**Haiku bilan ishlaydi:**
- SQLAlchemy model definitions
- Pydantic schema definitions
- Oddiy CRUD router'lar
- Auth endpoint'lar (register/login)
- Analytics endpoint'lar
- Fayl yuklash handler

**Sonnet bilan ishlaydi:**
- Celery task dizayni
- Redis integratsiyasi
- Instagram Graph API
- TikTok Content Posting API
- Telegram Bot API
- Claude AI integratsiyasi
- Xavfsizlik kodi (JWT, encryption)

---

### 4. DevOps Agent

**Fayl:** `devops/agents/devops_agent.py`  
**Modellar:** `claude-haiku-4-5-20251001` (config fayllar) + `claude-sonnet-4-20250514` (murakkab skriptlar)

**Scope:** faqat `devops/` papkasi

**Haiku bilan ishlaydi:**
- Nginx config fayllari
- systemd unit fayllari
- Backup skriptlari
- .gitignore generation

**Sonnet bilan ishlaydi:**
- To'liq VPS setup skripti (`setup_vps.sh`)
- Rollback logikali deploy skripti

---

### Agent Muloqot Protokoli

Har bir agent task tugagandan so'ng `information/tasks/status/` papkasiga JSON fayl yozadi:

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

**Status qiymatlari:** `pending` | `in_progress` | `completed` | `failed` | `blocked`

Xato bo'lsa qo'shimcha maydonlar:
```json
{
  "error": "Xato tavsifi",
  "blocker": "BE-001 task tugamagan"
}
```

Team Lead agent barcha status fayllarini har 30 soniyada o'qib `v1-progress.md` ni yangilaydi.

---

### Model Tanlash Jadvali

| Task turi | Model |
|---|---|
| Documentation, markdown | `claude-haiku-4-5-20251001` |
| Boilerplate (models, schemas, types) | `claude-haiku-4-5-20251001` |
| Oddiy CRUD, auth formalar | `claude-haiku-4-5-20251001` |
| Shell skriptlar | `claude-haiku-4-5-20251001` |
| Config fayllar (nginx, systemd) | `claude-haiku-4-5-20251001` |
| Murakkab arxitektura dizayni | `claude-sonnet-4-20250514` |
| Platform API integratsiyalari | `claude-sonnet-4-20250514` |
| Celery + async task dizayni | `claude-sonnet-4-20250514` |
| AI servis integratsiyasi | `claude-sonnet-4-20250514` |
| Xavfsizlik kodi (JWT, encryption) | `claude-sonnet-4-20250514` |
| Murakkab UI (calendar, dashboard) | `claude-sonnet-4-20250514` |
| Rollback logikali deploy | `claude-sonnet-4-20250514` |
| Code review | `claude-sonnet-4-20250514` |

---

## Auth Tizimi

### JWT Flow
```
Register/Login → access_token (30 min) + refresh_token (7 kun)
                          ↓
              Authorization: Bearer <access_token>
                          ↓
              Token eskirsa → POST /auth/refresh → yangi tokenlar
```

### Xavfsizlik qatlamlari

| Qatlam | Implementatsiya |
|---|---|
| Parol hashing | `bcrypt` (passlib, cost factor 12) |
| JWT | `python-jose` HS256, alohida access/refresh types |
| Rate limiting | `slowapi`: login 10/min, register 5/min |
| Timing attack himoya | `verify_password` user topilmasa ham chaqiriladi |
| Credentials encryption | `Fernet` symmetric encryption |
| Email normalize | `strip().lower()` Pydantic validator'da |
| Password validatsiya | Min 8, uppercase, number, special char |
| CORS | `allowed_origins` env orqali production'da cheklash |
| Docs | Production'da `/api/docs` o'chirilgan |

### Parol Talablari (backend validator)
```python
# schemas/user.py — UserCreate.validate_password
- len >= 8
- re.search(r"[A-Z]", v)   # bosh harf
- re.search(r"[0-9]", v)   # raqam
- re.search(r"[!@#$%^&*...]", v)  # maxsus belgi
```

---

## Ma'lumotlar Bazasi Sxemasi

### Jadvallar

**users**
```
id          UUID (PK)
email       VARCHAR UNIQUE
hashed_password VARCHAR
full_name   VARCHAR nullable
is_active   BOOLEAN default true
is_admin    BOOLEAN default false
created_at  TIMESTAMP
```

**posts**
```
id            UUID (PK)
user_id       UUID (FK → users)
caption       TEXT nullable
media_url     VARCHAR nullable
media_type    VARCHAR nullable  -- image | video
platforms     JSONB             -- ["instagram:acc_id", ...]
scheduled_at  TIMESTAMP nullable
status        VARCHAR           -- draft|scheduled|publishing|published|failed
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

**accounts**
```
id            UUID (PK)
user_id       UUID (FK → users)
platform      VARCHAR           -- instagram|tiktok|telegram|...
account_name  VARCHAR
credentials   JSONB (Fernet encrypted)
is_active     BOOLEAN
created_at    TIMESTAMP
```

**post_templates**
```
id          UUID (PK)
user_id     UUID (FK → users)
name        VARCHAR
caption     TEXT nullable
platforms   JSONB
created_at  TIMESTAMP
```

**follower_snapshots**
```
id          UUID (PK)
account_id  UUID (FK → accounts)
count       INTEGER
recorded_at TIMESTAMP
```

---

## API Endpointlar

### Base URL
```
Development:  http://localhost:8000/api/v1
Production:   https://yourdomain.com/api/v1
```

Barcha himoyalangan endpointlar uchun header:
```
Authorization: Bearer <access_token>
```

### Auth
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| POST | `/auth/register` | No | Yangi hisob yaratish |
| POST | `/auth/login` | No | Kirish, tokenlar olish |
| POST | `/auth/refresh` | No | Access tokenni yangilash |
| GET | `/auth/me` | Yes | Joriy foydalanuvchi |
| PUT | `/auth/me` | Yes | Profilni yangilash |

### Posts
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| POST | `/posts` | Yes | Post yaratish |
| GET | `/posts` | Yes | Postlar ro'yxati |
| GET | `/posts/{id}` | Yes | Bitta post |
| PUT | `/posts/{id}` | Yes | Postni yangilash |
| DELETE | `/posts/{id}` | Yes | Postni o'chirish |

### Accounts
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| POST | `/accounts` | Yes | Hisob ulash |
| GET | `/accounts` | Yes | Hisoblar ro'yxati |
| DELETE | `/accounts/{id}` | Yes | Hisobni uzish |
| POST | `/accounts/{id}/verify` | Yes | Token tekshirish |

### AI
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| POST | `/ai/generate-plan` | Yes | Haftalik kontent rejasi |
| POST | `/ai/generate-caption` | Yes | Post sarlavhasi |
| POST | `/ai/suggest-ideas` | Yes | Post g'oyalari |

### Upload
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| POST | `/upload/media` | Yes | Rasm/video yuklash |

### Analytics
| Method | URL | Auth | Tavsif |
|---|---|---|---|
| GET | `/analytics/overview` | Yes | Haftalik statistika |
| GET | `/analytics/by-platform` | Yes | Platforma bo'yicha |

---

## Celery Task Queue

### Konfiguratsiya
```python
# tasks/celery_app.py
broker_url = settings.redis_url
result_backend = settings.redis_url
```

### Tasklar

**post_tasks.py** — Post yuborish:
```python
@celery.task
def publish_post(post_id: str):
    # Post statusini "publishing" ga o'zgartir
    # Platform servisini chaqir (Instagram/Telegram/TikTok...)
    # Muvaffaqiyatli → "published"
    # Xato → "failed"
```

**ai_tasks.py** — AI generation:
```python
@celery.task
def generate_content_plan(user_id, niche, ...):
    # Ollama yoki Claude API ga so'rov
    # Natijani DB ga yozish
```

**beat_tasks.py** — Periodic tasks:
```python
# Har 1 daqiqada — scheduled postlarni tekshirish
# Vaqti kelgan postlarni publish_post task'ga yuborish
```

---

## Environment Variables

`.env` fayl to'liq ro'yxati:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/contentflow
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=min-32-chars-random-string
ENCRYPTION_KEY=fernet-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# AI
OLLAMA_URL=http://localhost:11434
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-oss-120b:free
ANTHROPIC_API_KEY=

# Social Platforms
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TELEGRAM_BOT_TOKEN=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=

# App
ENVIRONMENT=development  # yoki production
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
MEDIA_DIR=./media
```

**Fernet key generatsiya:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Local Development Setup

```bash
# 1. Clone
git clone https://github.com/devAsliddin/contentflow.git
cd contentflow

# 2. Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # .env ni to'ldiring

# 3. DB yarating
createdb contentflow
alembic upgrade head

# 4. FastAPI ishga tushiring
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. Celery (yangi terminal)
celery -A app.tasks.celery_app worker --loglevel=info

# 6. Frontend (yangi terminal)
cd ../frontend
npm install
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

- Backend: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- Frontend: http://localhost:5173

---

## Production Deploy (Ubuntu 22.04 VPS)

```bash
# VPS ni sozlash (bir marta)
scp devops/scripts/setup_vps.sh root@YOUR_IP:/tmp/
ssh root@YOUR_IP "bash /tmp/setup_vps.sh"

# .env ni /etc/contentflow/.env ga joylang
sudo cp backend/.env.example /etc/contentflow/.env
sudo nano /etc/contentflow/.env
sudo chmod 600 /etc/contentflow/.env

# systemd servislarni o'rnating
sudo cp devops/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-backend contentflow-celery

# Nginx sozlash
sudo cp devops/nginx/contentflow.conf /etc/nginx/sites-available/contentflow
sudo ln -s /etc/nginx/sites-available/contentflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Deploy
cd /var/www/contentflow
bash devops/scripts/deploy.sh
```

Deploy skripti avtomatik:
1. GitHub'dan oxirgi kodlarni tortadi
2. Python va Node.js paketlarini yangilaydi
3. DB migration'larni ishga tushiradi
4. React frontendni build qiladi
5. Barcha systemd servislarni qayta ishga tushiradi
6. Health check o'tkazadi
7. Muvaffaqiyatsiz bo'lsa — rollback qiladi

---

## Foydali Buyruqlar

```bash
# Servislar holati
sudo systemctl status contentflow-backend
sudo systemctl status contentflow-celery

# Loglar
journalctl -u contentflow-backend -f
journalctl -u contentflow-celery -f
tail -f /var/log/nginx/error.log

# Barcha servislarni qayta ishga tushirish
bash /var/www/contentflow/devops/scripts/restart_services.sh

# DB backup
bash /var/www/contentflow/devops/scripts/backup.sh
```

---

## Muammo va Takliflar

GitHub Issues: [https://github.com/devAsliddin/contentflow/issues](https://github.com/devAsliddin/contentflow/issues)
