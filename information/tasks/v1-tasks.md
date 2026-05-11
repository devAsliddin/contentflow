# ContentFlow V1 — Task List

## BACKEND TASKS

- [ ] **BE-001** [Sonnet] — Project setup: FastAPI app, PostgreSQL connection, Redis connection, Alembic setup, CORS, environment config with pydantic-settings. Create `.env.example`.
- [ ] **BE-002** [Sonnet] — Database models: User, Account (type: instagram/tiktok/telegram, credentials encrypted), Post (content, media_url, platforms[], scheduled_at, status), PostLog (execution results). Write Alembic migration.
- [ ] **BE-003** [Haiku] — Auth system: JWT-based auth, register/login endpoints, password hashing with bcrypt, refresh tokens.
- [ ] **BE-004** [Haiku] — CRUD routers: posts (create, list, update, delete, get by id), accounts (connect, list, disconnect), users (profile, update).
- [ ] **BE-005** [Sonnet] — Celery + Redis task queue: celery_app setup, post_tasks.py with `schedule_post` task that fires at scheduled_at time, retry logic (3 attempts), status updates to DB.
- [ ] **BE-006** [Sonnet] — Telegram service: connect bot via token, verify bot is added to channel, send text/photo/video to channel at scheduled time.
- [ ] **BE-007** [Sonnet] — Instagram service: Instagram Graph API integration, connect account via access token, post photo/reel to feed, support multiple accounts.
- [ ] **BE-008** [Sonnet] — TikTok service: TikTok Content Posting API, upload video, schedule post, support multiple accounts.
- [ ] **BE-009** [Sonnet] — AI Plan service: Claude API integration, system prompt for content planning, endpoint `POST /ai/generate-plan` takes {niche, frequency, tone, platforms} returns weekly content calendar as JSON.
- [ ] **BE-010** [Sonnet] — AI Content Assist: endpoint `POST /ai/generate-caption` takes {topic, platform, tone} returns generated caption. Endpoint `POST /ai/suggest-ideas` returns 5 post ideas based on recent history.
- [ ] **BE-011** [Haiku] — Analytics endpoints: `GET /analytics/overview` returns total posts, scheduled, published, failed this week. `GET /analytics/by-platform` breakdown per platform.
- [ ] **BE-012** [Haiku] — File upload: `POST /upload/media` accepts video/image, stores to local /media/ folder, returns URL. Validate file size (max 500MB video, 20MB image).

## FRONTEND TASKS

- [ ] **FE-001** [Haiku] — Project setup: Vite + React + TypeScript, TailwindCSS, shadcn/ui init, Zustand, React Query, Axios, React Router v6, lucide-react, recharts. Configure tsconfig paths.
- [ ] **FE-002** [Sonnet] — App shell: Dark theme design system (CSS variables), Sidebar with navigation (Dashboard, New Post, Accounts, Calendar, AI Plan, Analytics), TopBar with greeting + notifications, Layout wrapper, smooth page transitions.
- [ ] **FE-003** [Sonnet] — Dashboard page: Stats cards with sparkline charts (recharts), Upcoming posts timeline with platform icons + status badges, AI Suggestions panel. Use React Query to fetch real data.
- [ ] **FE-004** [Sonnet] — New Post page: Drag-and-drop upload zone (react-dropzone), Caption textarea with AI-assist button (calls generate-caption API), Platform selector (toggleable pills showing per-account selection), Date/time picker, "Post Now" vs "Schedule" toggle, submit to queue.
- [ ] **FE-005** [Sonnet] — Connected Accounts page: Telegram section (bot token input, channel name, connection status), Instagram section (account cards with avatar/username/followers, add/remove, max 3), TikTok section (same as Instagram). Platform-colored border glow on cards.
- [ ] **FE-006** [Sonnet] — Content Calendar: Monthly grid view, colored dots per platform per day, Week/Month toggle, click day → slide-in drawer with post details, navigate months.
- [ ] **FE-007** [Sonnet] — AI Plan Generator page: Form (niche dropdown, frequency, tone, platforms), "Generate Plan" button → calls AI API → displays weekly grid (Mon-Sun) with post idea cards, ability to add all to queue.
- [ ] **FE-008** [Haiku] — Auth pages: Login form, Register form, protected routes, JWT storage in httpOnly cookie via API, auto-refresh.
- [ ] **FE-009** [Haiku] — Zustand stores: auth store (user, token, login/logout actions), posts store (posts list, filters, optimistic updates), ui store (sidebar open/close, active page, notifications).
- [ ] **FE-010** [Haiku] — API service layer: Axios instance with base URL from env, request/response interceptors (attach token, handle 401 refresh), typed service functions for all endpoints.
- [ ] **FE-011** [Haiku] — TypeScript types: all shared types (Post, Account, User, Platform, ScheduleStatus, AiPlan), API response wrappers, form types.
- [ ] **FE-012** [Haiku] — Polish pass: loading skeletons for all data-fetching components, error states, empty states, toast notifications (sonner), mobile responsiveness check.

## DEVOPS TASKS

- [ ] **DO-001** [Sonnet] — VPS setup script (`setup_vps.sh`): Install Python 3.11, Node.js 20, PostgreSQL 15, Redis, Nginx, Git. Create `contentflow` system user. Set up firewall (ufw: allow 22, 80, 443). Create /var/www/contentflow directory.
- [ ] **DO-002** [Haiku] — Environment setup: Create /etc/contentflow/.env with all required variables (DATABASE_URL, REDIS_URL, SECRET_KEY, ANTHROPIC_API_KEY, etc.). Set proper permissions (600).
- [ ] **DO-003** [Haiku] — Systemd services: contentflow-backend.service (uvicorn), contentflow-celery.service (celery worker), contentflow-frontend.service (serve built React app). Enable on boot.
- [ ] **DO-004** [Haiku] — Nginx config: Reverse proxy /api → FastAPI (port 8000), serve React build at /, handle large file uploads (client_max_body_size 512M), gzip compression.
- [ ] **DO-005** [Sonnet] — Deploy script (`deploy.sh`): Git pull, pip install, alembic upgrade head, npm install + build, restart systemd services, health check (curl /api/health), rollback on failure.
- [ ] **DO-006** [Haiku] — Backup script: Daily PostgreSQL dump to /var/backups/contentflow/, keep last 7 days, log to /var/log/contentflow/backup.log.
- [ ] **DO-007** [Haiku] — GitHub setup: Init git repo, create .gitignore (node_modules, __pycache__, .env, media/, *.pyc, dist/), initial commit, push to GitHub. Tag as v1.0.0 after all tasks complete.
