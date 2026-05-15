# ContentFlow — Agent System Documentation

> Bu hujjat har bir agent nima ish bajarganini, qanday fayllar yaratganini va qanday qarorlar qabul qilganini batafsil tushuntiradi.

---

## 1. Team Lead Agent

**Fayl:** `backend/agents/team_lead_agent.py`  
**Model:** claude-sonnet-4-20250514 (qarorlar) + claude-haiku-4-5-20251001 (holat yangilash)

### Nima ish qildi?

Team Lead Agent — loyihani boshqaruvchi koordinator. U hech qanday kod yozmaydi, faqat boshqa agentlarga vazifalarni taqsimlaydi va jarayonni kuzatib boradi.

**Bajargan vazifalari:**
- `information/tasks/v1-tasks.md` faylini o'qib, har bir vazifani tegishli agentga yubordi
- `information/tasks/v1-progress.md` faylini real-vaqtda yangiladi
- `information/tasks/v1-changelog.md` faylida har bir o'zgarishni qayd etdi
- Agent statuslarini `information/tasks/status/` papkasidan har 30 soniyada tekshirdi

**Yaratgan/boshqargan fayllar:**
```
information/tasks/v1-tasks.md         — barcha vazifalar ro'yxati
information/tasks/v1-progress.md      — bajarilish holati (%)
information/tasks/v1-changelog.md     — o'zgarishlar jurnali
information/tasks/status/*.json       — har bir agent uchun status fayllar
```

**Routing qoidalari:**
| Vazifa turi | Yo'naltiriladi |
|-------------|----------------|
| React, TypeScript, CSS | Frontend Agent |
| FastAPI, PostgreSQL, Celery | Backend Agent |
| Nginx, systemd, deploy | DevOps Agent |
| Hujjatlar, koordinatsiya | Team Lead (o'zi) |

---

## 2. Frontend Agent

**Fayl:** `frontend/src/agents/frontend-agent.ts`  
**Model:** claude-haiku-4-5-20251001 (boilerplate) + claude-sonnet-4-20250514 (murakkab logika)

### Nima ish qildi?

Frontend Agent butun React ilovasini noldan qurdi. Stack: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui.

**Bajargan asosiy vazifalar:**

#### Sahifalar (Pages)
| Sahifa | Fayl | Tavsif |
|--------|------|--------|
| Landing Page | `pages/LandingPage.tsx` | Ommaviy bosh sahifa, foydalanuvchilarni tanitish |
| Login | `pages/LoginPage.tsx` | JWT autentifikatsiya |
| Register | `pages/RegisterPage.tsx` | Yangi foydalanuvchi ro'yxatdan o'tish |
| Dashboard | `pages/DashboardPage.tsx` | Umumiy statistika va tezkor harakatlar |
| New Post | `pages/NewPostPage.tsx` | Post yaratish (AI caption bilan) |
| Calendar | `pages/CalendarPage.tsx` | Rejalashtirilgan postlar takvimi |
| Accounts | `pages/AccountsPage.tsx` | Ijtimoiy tarmoq akkauntlari boshqaruvi |
| Analytics | `pages/AnalyticsPage.tsx` | Hisobot va grafik ko'rinish |
| AI Plan | `pages/AiPlanPage.tsx` | Claude AI bilan kontent rejasi |
| Drafts | `pages/DraftsPage.tsx` | Qoralamalar boshqaruvi |
| Approval | `pages/ApprovalPage.tsx` | Kontent tasdiqlash oqimi |
| Templates | `pages/TemplatesPage.tsx` | Qayta ishlatiluvchi shablonlar |
| Settings | `pages/SettingsPage.tsx` | Profil va ilova sozlamalari |
| Admin | `pages/AdminPage.tsx` | Admin paneli (faqat adminlar uchun) |

#### Komponentlar
```
components/layout/Layout.tsx        — asosiy layout (sidebar + topbar)
components/layout/Sidebar.tsx       — yon menyu navigatsiyasi
components/layout/TopBar.tsx        — yuqori panel (qidiruv, bildirishnoma)
components/dashboard/StatsCard.tsx  — statistika kartochkasi
components/posts/BulkUploadModal.tsx— ommaviy yuklash modal
components/posts/RecycleModal.tsx   — postni qayta ishlatish modal
components/accounts/               — akkount boshqaruvi komponentlari
components/ui/                     — shadcn/ui asosiy komponentlari
```

#### State Management (Zustand)
```
store/auth.store.ts    — foydalanuvchi autentifikatsiya holati
store/ui.store.ts      — UI holati (sidebar, tema)
store/post.store.ts    — post yaratish holati
```

#### API Services (Axios)
```
services/auth.service.ts       — login, register, refresh token
services/posts.service.ts      — CRUD postlar, media yuklash
services/accounts.service.ts   — akkountlar CRUD
services/analytics.service.ts  — hisobot so'rovlari
services/ai.service.ts         — AI caption va reja so'rovlari
services/workflows.service.ts  — ish oqimlari boshqaruvi
```

**Haiku ishlatgan vazifalar:**
- Zustand store scaffolding
- TypeScript type definitions
- Axios service stubs
- UI boilerplate komponentlari

**Sonnet ishlatgan vazifalar:**
- Dashboard complex hooks va data fetching
- Calendar drag-and-drop logikasi
- AI Plan Generator murakkab UI
- Multi-step form flows (NewPostPage)
- Auth flow (JWT token refresh)

---

## 3. Backend Agent

**Fayl:** `backend/agents/backend_agent.py`  
**Model:** claude-haiku-4-5-20251001 (scaffolding) + claude-sonnet-4-20250514 (murakkab servislar)

### Nima ish qildi?

Backend Agent FastAPI ilovasini to'liq qurdi. Async SQLAlchemy, Celery task queue, va 3 ta platform API integratsiyasini amalga oshirdi.

**Bajargan asosiy vazifalar:**

#### FastAPI Ilovasi
```
backend/app/main.py              — FastAPI app, CORS, lifespan hooks
backend/app/config.py            — pydantic-settings konfiguratsiya
backend/app/database.py          — async PostgreSQL bog'lanish
```

#### Modellar (SQLAlchemy Async)
```
backend/app/models/user.py       — foydalanuvchilar jadvali
backend/app/models/account.py    — ijtimoiy tarmoq akkauntlari
backend/app/models/post.py       — postlar va ularning holati
backend/app/models/post_template.py — post shablonlari
```

#### Alembic Migrations
```
backend/alembic/versions/001_create_users.py
backend/alembic/versions/002_create_accounts_posts.py
backend/alembic/versions/003_post_logs.py
backend/alembic/versions/004_add_post_platform_options.py
backend/alembic/versions/005_v2_indexes_and_templates.py
```

#### API Routerlar
```
backend/app/routers/auth.py        — /api/v1/auth/* (login, register, refresh)
backend/app/routers/posts.py       — /api/v1/posts/* (CRUD, media yuklash)
backend/app/routers/accounts.py    — /api/v1/accounts/* (CRUD)
backend/app/routers/analytics.py   — /api/v1/analytics/*
backend/app/routers/scheduler.py   — /api/v1/scheduler/* (post rejalashtirish)
backend/app/routers/ai.py          — /api/v1/ai/* (caption, plan yaratish)
backend/app/routers/ai_v2_ext.py   — /api/v1/ai/v2/* (kengaytirilgan AI)
backend/app/routers/analytics_v2.py— /api/v1/analytics/v2/*
backend/app/routers/workflows.py   — /api/v1/workflows/*
```

#### Platform Integratsiyalar
```
backend/app/services/instagram_service.py  — Instagram Graph API
backend/app/services/telegram_service.py   — Telegram Bot API
backend/app/services/tiktok_service.py     — TikTok Content Posting API
backend/app/services/ai_service.py         — Anthropic Claude API
backend/app/services/encryption.py         — akkount ma'lumotlarini shifrlash
```

#### Celery Task Queue
```
backend/app/tasks/celery_app.py    — Celery konfiguratsiyasi (Redis broker)
backend/app/tasks/post_tasks.py    — post nashr qilish vazifalari
backend/app/tasks/beat_tasks.py    — vaqtli rejalashtirilgan vazifalar
```

**Haiku ishlatgan vazifalar:**
- Model va schema yaratish
- CRUD routerlar
- Auth endpoints
- Pydantic schemas

**Sonnet ishlatgan vazifalar:**
- Celery task dizayni
- Instagram/TikTok/Telegram API integratsiyasi
- JWT + bcrypt xavfsizlik kodi
- Fernet shifrlash (credentials saqlash)
- AI servis integratsiyasi

---

## 4. DevOps Agent

**Fayl:** `devops/agents/devops_agent.py`  
**Model:** claude-haiku-4-5-20251001 (konfiguratsiya fayllar) + claude-sonnet-4-20250514 (murakkab skriptlar)

### Nima ish qildi?

DevOps Agent loyihani serverga deploy qilish uchun barcha infratuzilmani tayyorladi. Ikkita deployment strategiyasi mavjud:

#### A) Systemd + Nginx (VPS Native)
```
devops/scripts/setup_vps.sh        — Ubuntu 22.04 VPS sozlash skripti
devops/scripts/deploy.sh           — rollback bilan deploy skript
devops/scripts/backup.sh           — PostgreSQL backup avtomatizatsiyasi
devops/scripts/restart_services.sh — servislarni qayta ishga tushirish
devops/nginx/contentflow.conf      — Nginx virtual host konfiguratsiyasi
devops/nginx/nginx.conf            — asosiy Nginx konfiguratsiyasi
devops/systemd/contentflow-backend.service    — FastAPI systemd unit
devops/systemd/contentflow-celery.service     — Celery worker systemd unit
devops/systemd/contentflow-celery-beat.service— Celery beat systemd unit
```

**setup_vps.sh nima qiladi:**
1. Python 3.11, Node.js 20, PostgreSQL 15, Redis, Nginx o'rnatadi
2. `contentflow` tizim foydalanuvchisini yaratadi
3. SSL sertifikat oladi (Let's Encrypt + Certbot)
4. UFW firewall sozlaydi (22, 80, 443 portlar)
5. fail2ban himoya o'rnatadi
6. Barcha kerakli papkalarni yaratadi

**deploy.sh nima qiladi:**
1. Joriy git commit-ni rollback nuqtasi sifatida saqlaydi
2. `git pull origin main` bilan yangi kodni tortib oladi
3. Python dependency-larni yangilaydi
4. Alembic migration-larni ishlatadi
5. Frontend-ni build qiladi (`npm run build`)
6. Nginx static fayllarini yangilaydi
7. Systemd servislarni qayta ishga tushiradi
8. Health check (`/api/health`) o'tkazadi — muvaffaqiyatsiz bo'lsa rollback

#### B) Docker Compose (Konteynerlar)
```
docker-compose.yml                 — barcha servislar (backend, celery, frontend, nginx, postgres, redis)
Dockerfile.backend                 — FastAPI + Celery uchun Docker image
Dockerfile.frontend                — React build + Nginx uchun Docker image
devops/nginx/nginx-docker.conf     — Docker muhiti uchun Nginx konfiguratsiya
```

**docker-compose.yml tuzilmasi:**
| Servis | Port | Tavsif |
|--------|------|--------|
| nginx | 80, 443 | Reverse proxy + SSL termination |
| frontend | (ichki) | React static fayllar |
| backend | 8000 (ichki) | FastAPI Uvicorn |
| celery | — | Celery worker |
| celery-beat | — | Vaqtli vazifalar |
| postgres | 5432 (ichki) | PostgreSQL 15 |
| redis | 6379 (ichki) | Redis 7 (broker + cache) |

**Haiku ishlatgan vazifalar:**
- Nginx konfiguratsiya fayllar
- Systemd unit fayllar
- Backup skriptlari
- .gitignore yaratish
- Docker environment fayllar

**Sonnet ishlatgan vazifalar:**
- `setup_vps.sh` — to'liq VPS sozlash skripti
- `deploy.sh` — rollback logikasi bilan deploy
- `docker-compose.yml` — multi-service orchestration
- SSL va xavfsizlik sozlamalari

---

## Agent Muloqot Protokoli

Har bir agent vazifani tugatgandan so'ng `information/tasks/status/` papkasiga JSON fayl yozadi:

```json
{
  "agent": "frontend-agent",
  "task_id": "FE-001",
  "status": "completed",
  "files_changed": [
    "frontend/src/components/layout/Layout.tsx"
  ],
  "notes": "Landing page yaratildi. Mobile responsive.",
  "timestamp": "2025-05-15T10:00:00Z"
}
```

**Status qiymatlari:** `pending` | `in_progress` | `completed` | `failed` | `blocked`

---

## Model Tanlash Qoidalari

| Vazifa turi | Model |
|-------------|-------|
| Hujjatlar, markdown | claude-haiku-4-5-20251001 |
| Boilerplate (modellar, schemalar, typlar) | claude-haiku-4-5-20251001 |
| Oddiy CRUD, auth formalar | claude-haiku-4-5-20251001 |
| Shell skriptlar (oddiy) | claude-haiku-4-5-20251001 |
| Nginx/systemd konfiguratsiya fayllar | claude-haiku-4-5-20251001 |
| Murakkab arxitektura | claude-sonnet-4-20250514 |
| Platform API integratsiyalar | claude-sonnet-4-20250514 |
| Celery + async task dizayni | claude-sonnet-4-20250514 |
| AI servis integratsiyasi | claude-sonnet-4-20250514 |
| Xavfsizlik kodi (JWT, shifrlash) | claude-sonnet-4-20250514 |
| Murakkab UI (calendar, dashboard) | claude-sonnet-4-20250514 |
| Rollback logikasi bilan deploy skript | claude-sonnet-4-20250514 |
| Kod review | claude-sonnet-4-20250514 |
