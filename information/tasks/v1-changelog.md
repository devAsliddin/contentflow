# ContentFlow V1 — Changelog

## V1 Changelog

### [INIT] Project initialization
- Created full folder structure (backend/, frontend/, devops/, information/)
- Wrote all documentation (architecture.md, api-reference.md, setup-guide.md, agent-system.md)
- Initialized v1-tasks.md, v1-progress.md, v1-changelog.md

### [BE-001] Backend project setup
- Created FastAPI app with lifespan context (startup/shutdown)
- PostgreSQL async connection via SQLAlchemy 2.x with asyncpg
- Redis connection for Celery broker + backend
- pydantic-settings config loaded from .env
- CORS middleware configured for localhost:5173 and production domain
- Static file serving for /media uploads
- Health check endpoint GET /api/health
- Created requirements.txt and .env.example

### [BE-002] Database models + Alembic migration
- User model: id (UUID), email, hashed_password, full_name, is_active, timestamps
- Account model: user_id FK, platform, account_name, credentials (encrypted), is_active
- Post model: user_id FK, caption, media_url, media_type, platforms (JSON array), scheduled_at, status, celery_task_id
- PostLog model: post_id FK, account_id FK, platform, status, external_id, error_message
- Alembic env.py configured for async PostgreSQL
- Migration 001_initial_schema.py creates all tables with indexes

### [BE-003] JWT auth system
- JWT tokens with python-jose (RS256 → HS256 with SECRET_KEY)
- BCrypt password hashing via passlib
- Access token (30min TTL) + Refresh token (7 days TTL)
- POST /api/v1/auth/register — creates user, returns token pair
- POST /api/v1/auth/login — validates credentials, returns token pair
- POST /api/v1/auth/refresh — exchanges refresh token for new pair
- GET /api/v1/auth/me — returns current user profile
- PUT /api/v1/auth/me — update full_name
- get_current_user dependency for protected routes

### [BE-004] CRUD routers
- posts.py: POST/GET(list)/GET(single)/PUT/DELETE + query params (skip, limit, status filter)
- accounts.py: POST connect / GET list / DELETE disconnect / POST verify
- Encryption service: Fernet-based credential encryption/decryption
- Max 3 accounts per platform enforced on connect
- Auto-schedule via Celery when scheduled_at is set on post creation
- Revoke Celery task on post deletion

### [BE-005] Celery + Redis task queue
- celery_app.py: Celery instance with Redis broker/backend, task serialization config
- post_tasks.py: schedule_post task with max_retries=3, retry_delay=60s
- _publish_post: async function runs in asyncio.run(), loads post from DB
- Per-platform dispatch: calls telegram/instagram/tiktok service
- Per-platform PostLog created (success or failed)
- Post status updated to published/failed after all platforms
- ai_tasks.py: async AI generation task for background use

### [BE-006] Telegram service
- verify_telegram_bot: GET /getMe to check bot token validity
- send_post_to_telegram: sendPhoto / sendVideo / sendMessage based on media_type
- get_channel_info: fetch channel metadata
- Returns Telegram message_id as external_id

### [BE-007] Instagram Graph API service
- verify_instagram_token: GET /me with access token
- post_to_instagram: Two-step (create container → publish) for photos and Reels
- get_account_info: fetch followers_count, media_count, profile_picture_url

### [BE-008] TikTok Content Posting API service
- verify_tiktok_token: GET /user/info/ with Bearer token
- post_to_tiktok: POST /post/publish/video/init/ with PULL_FROM_URL source
- get_user_info: fetch display_name, avatar_url, follower_count

### [BE-009] AI Plan Generator
- AIService class with anthropic.AsyncAnthropic client
- generate_plan: uses claude-sonnet-4-20250514, returns WeeklyPlan JSON
- System prompt instructs strict JSON output (no markdown)
- POST /api/v1/ai/generate-plan endpoint

### [BE-010] AI Caption + Ideas endpoints
- generate_caption: uses claude-haiku-4-5-20251001, platform-aware char limits
- suggest_ideas: uses claude-haiku-4-5-20251001, uses recent published posts for context
- POST /api/v1/ai/generate-caption
- POST /api/v1/ai/suggest-ideas

### [BE-011] Analytics endpoints
- GET /api/v1/analytics/overview — total/scheduled/published/failed this week
- GET /api/v1/analytics/by-platform — breakdown per platform

### [BE-012] File upload handler
- POST /api/v1/upload/media — multipart/form-data file upload
- Validates content type: image/jpeg, png, webp, video/mp4, mov
- Max 20MB images, 500MB videos
- Saves to MEDIA_DIR with UUID filename
- Returns /media/filename URL

### [FE-001] Frontend project setup
- Vite 5 + React 18 + TypeScript 5
- TailwindCSS 3 with dark theme CSS variables
- shadcn/ui dependencies (Radix UI primitives)
- Zustand 4 for state management
- TanStack Query 5 for data fetching
- Axios 1 with interceptors
- React Router v6
- lucide-react icons
- Recharts for sparkline charts
- react-dropzone for file upload
- sonner for toast notifications
- date-fns for date formatting
- Path aliases: @/ → src/

### [FE-002] App shell + dark theme + layout
- Dark theme CSS variables in index.css (deep navy background)
- Platform colors: instagram=#E1306C, tiktok=#69C9D0, telegram=#229ED9
- Sidebar: collapsible (w-60 ↔ w-16), active state highlight, logout
- TopBar: greeting with time-of-day, notification bell with unread count
- Layout wrapper with Outlet for nested routes
- Smooth fade-in animation on page transitions

### [FE-003] Dashboard page
- 4 stats cards with recharts AreaChart sparklines (total, scheduled, published, failed)
- Color-coded cards (blue, yellow, green, red)
- UpcomingPosts panel with platform color dots, status badges
- AiSuggestions panel with lazy loading via button
- Loading skeletons for all data states
- React Query for real data fetching from analytics + posts API

### [FE-004] New Post page
- react-dropzone upload zone with progress indicator
- Preview for uploaded images/videos
- AI caption generator: topic input → calls /ai/generate-caption API
- Multi-account platform selector (toggleable pills with platform colors)
- Post Now / Schedule toggle
- datetime-local picker for scheduled posts
- Celery task queued on submit

### [FE-005] Connected Accounts page
- Sections per platform (Telegram, Instagram, TikTok)
- Add/remove accounts with inline form
- Platform-colored border glow on account cards
- Max 3 accounts per platform enforced (hides Add button when at limit)
- Verify button calls /accounts/{id}/verify

### [FE-006] Content Calendar
- Monthly grid view built with date-fns
- Colored platform dots on days with scheduled posts
- Navigate months with chevron buttons
- Click day → inline post detail panel
- Status badges (published/scheduled/failed)

### [FE-007] AI Plan Generator page
- Niche dropdown (12 niches), frequency slider (1-21/week)
- Tone selector (casual/professional/humorous/educational/inspirational)
- Platform multi-select with platform colors
- Weekly grid display (Mon-Sun) with post idea cards
- Add all to drafts button (bulk creates posts)

### [FE-008] Auth pages
- LoginPage: email/password form with validation
- RegisterPage: name/email/password form
- Protected routes via ProtectedRoute wrapper
- Tokens stored in localStorage + Zustand persist

### [FE-009] Zustand stores
- auth.store.ts: user, tokens, login/register/logout, persisted
- posts.store.ts: posts list, optimistic add/update/remove, status filter
- ui.store.ts: sidebar open/close, notifications (50 max), unread count

### [FE-010] API service layer
- Axios instance with VITE_API_URL base
- Request interceptor: attaches Bearer token
- Response interceptor: 401 → refresh token flow with queue
- postsService, accountsService, aiService typed service modules

### [FE-011] TypeScript types
- post.types.ts: Post, CreatePostRequest, UpdatePostRequest, Platform, PostStatus
- account.types.ts: Account, ConnectAccountRequest, AccountCredentials
- api.types.ts: User, AuthResponse, AnalyticsOverview, WeeklyPlan, etc.

### [FE-012] Polish pass
- Loading skeleton animations on UpcomingPosts
- Empty state messages
- Sonner toast notifications throughout
- Error handling in all mutation callbacks
- Custom scrollbar styles
- Platform glow utility classes

### [DO-001] VPS setup script
- setup_vps.sh: full Ubuntu 22.04 setup
- Installs Python 3.11, Node.js 20, PostgreSQL 15, Redis, Nginx
- Creates contentflow user with sudo
- Creates PostgreSQL database + user
- UFW firewall (22, 80, 443)
- fail2ban for SSH protection
- Creates /var/www/contentflow, /etc/contentflow, /var/log/contentflow

### [DO-002] Environment setup
- /etc/contentflow/.env with chmod 600
- Template in backend/.env.example

### [DO-003] Systemd services
- contentflow-backend.service: uvicorn with 2 workers
- contentflow-celery.service: celery worker with 4 concurrency
- contentflow-frontend.service: placeholder (Nginx serves static)
- EnvironmentFile=/etc/contentflow/.env, Restart=always

### [DO-004] Nginx config
- contentflow.conf: HTTP server on port 80
- /api/* → proxy to FastAPI :8000
- /media → proxy to FastAPI :8000
- / → serve React build from /var/www/html/contentflow
- client_max_body_size 512M
- Gzip compression enabled
- Static asset caching (1 year)
- Security headers

### [DO-005] Deploy script with rollback
- deploy.sh: git pull → pip install → alembic migrate → npm build → restart → health check
- Saves rollback commit hash before deploy
- Automatic rollback on any failure
- Health check: curl /api/health expects HTTP 200

### [DO-006] Backup script
- backup.sh: pg_dump | gzip to /var/backups/contentflow/
- Keeps last 7 days of backups
- Logs to /var/log/contentflow/backup.log

---

**V1 Status:** All backend, frontend, and devops tasks complete.
**Pending:** DO-007 (GitHub push) — requires real repo URL and credentials.
