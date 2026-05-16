# ContentFlow V2 — Changelog

## V2 Changelog

_(entries added after each task completes)_

---

### [V2-ACC-001] Instagram OAuth2
- **Created:** `app/routers/oauth.py`
- **Created:** `app/redis_client.py` — shared async Redis client using `redis.asyncio`
- **Modified:** `app/main.py` — added `oauth` router at `/api/v2/oauth`
- **Endpoints added:**
  - `GET /api/v2/oauth/instagram/authorize` — generates CSRF state token (stored in Redis, 10 min TTL), redirects to Instagram OAuth2 authorize URL with scope `instagram_basic,instagram_content_publish,pages_read_engagement`
  - `GET /api/v2/oauth/instagram/callback` — validates state, exchanges code for short-lived token, upgrades to long-lived token via `ig_exchange_token`, fetches username, stores encrypted credentials in `accounts` table (platform=`instagram`), redirects to frontend success URL

---

### [V2-ACC-002] TikTok OAuth2
- **Modified:** `app/routers/oauth.py` (same file as V2-ACC-001)
- **Modified:** `app/main.py` — already wired via oauth router at `/api/v2/oauth`
- **Endpoints added:**
  - `GET /api/v2/oauth/tiktok/authorize` — generates CSRF state token, redirects to TikTok OAuth2 authorize URL with scope `video.upload,video.list`
  - `GET /api/v2/oauth/tiktok/callback` — validates state, exchanges code for `access_token` + `refresh_token` + `open_id`, fetches display name, stores encrypted credentials in `accounts` table (platform=`tiktok`), redirects to frontend success URL

---

### [V2-ANA-001] Post performance dashboard API
- **Modified:** `app/routers/analytics.py` — added `GET /posts` endpoint
- **Modified:** `app/main.py` — analytics router also mounted at `/api/v2/analytics`
- **Endpoints added:**
  - `GET /api/v2/analytics/posts` — returns published posts for the authenticated user enriched with deterministic placeholder engagement metrics (`likes`, `views`, `reach`). Supports `?days=7` (default, max 90) and `?platform=instagram` query params. Response shape: `{days, platform, total, posts: [{post_id, caption_preview, platform, likes, views, reach, published_at}]}`

---

### [V2-ANA-002] Platform comparison API
- **Modified:** `app/routers/analytics.py` — added `GET /platforms/comparison` endpoint
- **Endpoints added:**
  - `GET /api/v2/analytics/platforms/comparison` — returns per-platform daily breakdown for the last N days. Response shape: `{days, platforms: [{platform, dates: [...], post_counts: [...], published_counts: [...]}]}`. Suitable for line/bar chart rendering.

---

### [V2-AI-001] Caption Rewriter
- **Created:** `app/routers/ai_v2.py`
- **Modified:** `app/main.py` — added `ai_v2` router at `/api/v2/ai`
- **Endpoints added:**
  - `POST /api/v2/ai/rewrite-caption` — rewrites a caption for a target platform using `claude-haiku-4-5-20251001`. Body: `{caption, target_platform: "instagram"|"tiktok"|"telegram", tone?}`. Platform-specific system prompts enforce style, hashtag guidance, and character limits. Response: `{rewritten_caption, platform, char_count}`

---

### [V2-UI-001] New Dashboard
- **Modified:** `contentflow/frontend/src/pages/DashboardPage.tsx` — full rewrite into V2 analytics dashboard
- **Created:** `contentflow/frontend/src/services/analytics.service.ts` — `getOverview()`, `getPlatformComparison(days?)`, `getPostPerformance(days?)`
- **Modified:** `contentflow/frontend/src/types/api.types.ts` — added `PlatformComparison`, `PostPerformance`, `PlatformDayCount` types

**What was added:**
- Top stats row (4 cards): Total posts, Published, Scheduled, Failed — each with 7-day sparkline derived from comparison data
- Platform Comparison BarChart (Telegram/Instagram/TikTok, brand colors) via `GET /api/v2/analytics/platforms/comparison`, shows graceful empty state if endpoint not ready
- Upcoming Posts panel: next 5 scheduled posts with platform chips, caption preview (truncated), time-remaining badge, status pill
- Post Performance table: last 10 published posts with platform icon, caption, published_at, views, likes, reach via `GET /api/v2/analytics/posts`; graceful empty state if endpoint not ready
- AI Suggestions panel with "Generate ideas" button, 5 clickable idea cards navigating to New Post page with pre-fill state
- Reach by platform summary bars using live comparison data
- All panels: TanStack Query, loading skeletons, error/empty states, no crashes on 4xx/5xx

---

### [V2-ANA-003] Follower growth dynamics
- **Created:** `backend/app/models/follower_snapshot.py` - stores per-account follower count snapshots.
- **Created:** `backend/alembic/versions/003_add_follower_snapshots.py` - adds `follower_snapshots` table and query indexes.
- **Modified:** `backend/app/models/account.py` and `backend/app/models/__init__.py` - registered snapshot relationship/model.
- **Modified:** `backend/app/routers/analytics.py` - added:
  - `GET /api/v2/analytics/followers` - returns daily follower growth series, account-level series, latest count, and delta.
  - `POST /api/v2/analytics/followers/snapshots` - stores a snapshot for a connected account so scheduled collectors or admin tools can ingest follower counts.
  - `GET /api/v2/analytics/platforms` - alias for the platform comparison endpoint required by the task list.
- **Modified:** `frontend/src/services/analytics.service.ts` - normalizes V2 analytics envelopes into dashboard-ready arrays and adds `getFollowerGrowth(days?)`.
- **Modified:** `frontend/src/types/api.types.ts` - added follower growth response types.

---

### [V2-AI-002] Hashtag Suggester
- **Modified:** `backend/app/routers/ai_v2.py` - added `POST /api/v2/ai/hashtags`.
- **Behavior:** returns combined `hashtags`, separate `trending` and `niche` lists, scored suggestions, platform, and source.
- **Resilience:** uses Claude for hashtag strategy when available, with a deterministic fallback generator if the AI request or JSON parsing fails.
- **Modified:** `frontend/src/services/ai.service.ts` - added `suggestHashtags(payload)` using the V2 AI base URL.
- **Modified:** `frontend/src/types/api.types.ts` - added hashtag request/response types.

---

### [V2-AI-003] Post tone analyzer
- **Modified:** `backend/app/routers/ai_v2.py` - added `POST /api/v2/ai/analyze-tone`.
- **Behavior:** returns dominant tone (`professional`, `casual`, `fun`, or `mixed`), normalized tone scores, confidence, suggestions, and source.
- **Resilience:** uses Claude for editorial tone analysis when available, with a deterministic lexical fallback if AI is unavailable.
- **Modified:** `frontend/src/services/ai.service.ts` - added `analyzeTone(payload)`.
- **Modified:** `frontend/src/types/api.types.ts` - added tone analyzer request/response types.

---

### [V2-ANA-004] Weekly auto PDF report — 2026-05-15
- **Created:** `backend/app/routers/analytics_v2.py` — `POST /api/v2/analytics/report`
- **Behavior:** Generates a PDF using ReportLab (summary table, platform breakdown, recent published posts). Returns as `application/pdf` download. Also attempts to send the PDF to the user's first connected Telegram channel.
- **Modified:** `backend/app/main.py` — registered `analytics_v2` router at `/api/v2/analytics`
- **Added service method:** `workflowsService.downloadReport()` in frontend

---

### [V2-ANA-005] Best posting time AI analysis — 2026-05-15
- **Created:** `backend/app/routers/analytics_v2.py` — `GET /api/v2/analytics/best-time`
- **Behavior:** Analyses `PostLog.executed_at` grouped by hour and weekday. Returns best hour, day_of_week, day_name, hourly and daily distributions, and a recommendation text. Falls back to sensible defaults if no data.
- **Caching:** Results cached in Redis for 1 hour per user (V2-INFRA-002)

---

### [V2-AI-004] Weekly content plan v2 — 2026-05-15
- **Created:** `backend/app/routers/ai_v2_ext.py` — `POST /api/v2/ai/generate-plan`
- **Uses:** `claude-sonnet-4-20250514`
- **Behavior:** Generates enhanced weekly plan with per-post hashtags, best times (inferred from PostLog history + platform defaults), hook text, media_type suggestion. Returns `{week_start, days, best_times, hashtag_suggestions, generated_at}`
- **Modified:** `backend/app/main.py` — registered `ai_v2_ext` router at `/api/v2/ai`

---

### [V2-AI-005] A/B caption variants — 2026-05-15
- **Modified:** `backend/app/routers/ai_v2_ext.py` — `POST /api/v2/ai/ab-captions`
- **Uses:** `claude-haiku-4-5-20251001`
- **Behavior:** Generates 2-5 distinct caption variants (question-led, story-led, data-led, etc.) each with label, caption, char_count, hashtags, hook, rationale. Includes overall recommendation.

---

### [V2-WF-001] Draft queue backend — 2026-05-15
- **Modified:** `backend/app/routers/posts.py` — existing `GET /api/v1/posts?status=draft` already works via `status_filter` query param. No changes needed.
- **Created:** `frontend/src/pages/DraftsPage.tsx` — lists draft posts, provides Edit / Schedule / Submit for Review / Delete actions.

---

### [V2-WF-002] Approval flow — 2026-05-15
- **Created:** `backend/app/routers/workflows.py` — `PUT /api/v2/posts/{id}/status`
- **Allowed transitions:** `draft→pending_review→approved→scheduled/published`, `pending_review→draft` (reject), `failed→draft/scheduled`
- **Created:** `frontend/src/pages/ApprovalPage.tsx` — lists `pending_review` posts with Approve / Reject buttons

---

### [V2-WF-003] Repost/Recycle — 2026-05-15
- **Modified:** `backend/app/routers/workflows.py` — `POST /api/v2/posts/{id}/recycle`
- **Behavior:** Duplicates a published/failed post with a new `scheduled_at`, creates Celery task
- **Created:** `frontend/src/components/posts/RecycleModal.tsx` — modal with date picker + mini calendar
- **Modified:** `frontend/src/pages/CalendarPage.tsx` — added Recycle button on published post cards in day drawer

---

### [V2-WF-004] Bulk upload — 2026-05-15
- **Modified:** `backend/app/routers/workflows.py` — `POST /api/v2/upload/bulk` (up to 10 files)
- **Created:** `frontend/src/components/posts/BulkUploadModal.tsx` — multi-file dropzone with per-file progress status

---

### [V2-WF-005] Post templates — 2026-05-15
- **Created:** `backend/app/models/post_template.py` — `PostTemplate` SQLAlchemy model
- **Modified:** `backend/app/models/user.py` — added `templates` relationship
- **Modified:** `backend/app/models/__init__.py` — exported `PostTemplate`
- **Modified:** `backend/app/routers/workflows.py` — `GET/POST/GET/{id}/DELETE /api/v2/templates`
- **Created:** `frontend/src/pages/TemplatesPage.tsx` — template CRUD UI with create modal, hashtag chips
- **Modified:** `frontend/src/services/workflows.service.ts` — all workflow API calls

---

### [V2-ACC-003] OAuth2 migration — 2026-05-15
- **Modified:** `backend/alembic/versions/005_v2_indexes_and_templates.py` — added `oauth_migrated` + `oauth_migrated_at` columns to `accounts`
- **Modified:** `backend/app/routers/workflows.py` — `GET /api/v2/accounts/migration-status`
- **Created:** `frontend/src/components/accounts/MigrationBanner.tsx` — banner with reconnect link shown when `needs_reconnect > 0`
- **Modified:** `frontend/src/components/layout/Layout.tsx` — included `MigrationBanner`

---

### [V2-NOT-001] Success notification — 2026-05-15
- **Modified:** `backend/app/tasks/post_tasks.py` — added `_notify_post_result()` helper called after each publish job
- **Behavior:** On success sends ✅ message with platform names to user's Telegram channel(s)

---

### [V2-NOT-002] Error notification — 2026-05-15
- **Modified:** `backend/app/tasks/post_tasks.py` — same `_notify_post_result()` helper
- **Behavior:** On failure sends ❌ message with error details per platform

---

### [V2-NOT-003] Weekly Celery beat task — 2026-05-15
- **Modified:** `backend/app/tasks/beat_tasks.py` — added `weekly_analytics_summary()` Celery task and `_send_weekly_summary()` async implementation
- **Modified:** `backend/app/tasks/celery_app.py` — registered crontab schedule: Monday 09:00 UTC using `from celery.schedules import crontab`
- **Behavior:** Sends per-user analytics summary (published/failed/scheduled counts + platform breakdown) to each user's first Telegram channel

---

### [V2-INFRA-001] PostgreSQL indexes — 2026-05-15
- **Created:** `backend/alembic/versions/005_v2_indexes_and_templates.py`
- **Indexes added:** `ix_posts_user_status`, `ix_posts_user_scheduled_at`, `ix_posts_status_scheduled_at`, `ix_post_logs_platform`, `ix_post_logs_post_platform`

---

### [V2-INFRA-002] Redis cache for analytics — 2026-05-15
- **Modified:** `backend/app/routers/analytics_v2.py` — `_cache_get()`, `_cache_set()`, `_cache_invalidate_user()` helpers using Redis, 1-hour TTL
- **Modified:** `backend/app/routers/posts.py` — calls `_cache_invalidate_user()` after post creation
- **Modified:** `backend/app/routers/workflows.py` — calls `_cache_invalidate_user()` after status transitions

---

### [V2-INFRA-003] Media CDN Nginx config — 2026-05-15
- **Created:** `devops/nginx-cdn.conf`
- **Content:** `/media/` with 1-year immutable cache, CORS headers, allowed media types only (jpg/png/webp/mp4/mov/pdf). Frontend `/assets/` also cached forever. API proxy with no-cache. Gzip compression for all text types.

---

### [V2-UI-002] Multi-account sidebar — 2026-05-15
- **Modified:** `frontend/src/components/layout/Sidebar.tsx` — added account switcher widget (shows platform chips + account names + active status dot), uses `useQuery` to load accounts
- **Added nav section:** Workflow links (Drafts, Approval, Templates)

---

### [V2-UI-003] Content Calendar v2 — 2026-05-15
- **Modified:** `frontend/src/pages/CalendarPage.tsx`
- **Added:** HTML5 drag-and-drop on `DayEvent` (scheduled/draft posts are draggable), day cells are drop targets
- **On drop:** calls `workflowsService.transitionStatus()` or `postsService.update()` to reschedule post to target day preserving time
- **Visual:** Drop target cells highlight with `bg-indigo-500/10`

---

### [V2-UI-004] Mobile responsive — 2026-05-15
- **Modified:** `frontend/src/components/layout/Layout.tsx` — mobile overlay backdrop, sidebar hidden below `md:` breakpoint, hamburger menu button visible on mobile
- **Modified:** `frontend/src/components/layout/Sidebar.tsx` — accepts `onMobileClose` prop, shows X button on mobile, collapse toggle hidden on mobile

---

### [V2-UI-005] Dark mode toggle — 2026-05-15
- **Modified:** `frontend/src/store/ui.store.ts` — added `theme: 'dark' | 'light'`, `toggleTheme()`, `setTheme()` actions; persists to localStorage via Zustand `persist`; applies `html.light` class on rehydration
- **Modified:** `frontend/src/index.css` — added `html.light` CSS custom properties and scrollbar overrides for light mode
- **Modified:** `frontend/src/components/layout/TopBar.tsx` — Sun/Moon icon toggle button

---

### [V2-WF-001 frontend] Drafts page — 2026-05-15
- **Created:** `frontend/src/pages/DraftsPage.tsx`
- **Modified:** `frontend/src/App.tsx` — added `/drafts` route
- **Modified:** `frontend/src/components/layout/Sidebar.tsx` — added Drafts nav link

---

### [V2-WF-002 frontend] Approval UI — 2026-05-15
- **Created:** `frontend/src/pages/ApprovalPage.tsx`
- **Modified:** `frontend/src/App.tsx` — added `/approval` route

---

### [V2-WF-003 frontend] Recycle button — 2026-05-15
- **Created:** `frontend/src/components/posts/RecycleModal.tsx`
- **Modified:** `frontend/src/pages/CalendarPage.tsx` — Recycle button on published posts in day drawer

---

### [V2-WF-004 frontend] Bulk upload UI — 2026-05-15
- **Created:** `frontend/src/components/posts/BulkUploadModal.tsx`

---

### [V2-WF-005 frontend] Template library — 2026-05-15
- **Created:** `frontend/src/pages/TemplatesPage.tsx`
- **Modified:** `frontend/src/App.tsx` — added `/templates` route

---

### [V2-ACC-003 frontend] Migration notice — 2026-05-15
- **Created:** `frontend/src/components/accounts/MigrationBanner.tsx`
- **Modified:** `frontend/src/components/layout/Layout.tsx`

---

### [V2-TEST-001] Backend unit tests — 2026-05-15
- **Created:** `backend/tests/__init__.py`
- **Created:** `backend/tests/conftest.py` — SQLite in-memory fixtures, user/account/post/log fixtures, async client with dependency overrides
- **Created:** `backend/tests/test_v2_analytics.py` — best-time and PDF report tests
- **Created:** `backend/tests/test_v2_ai.py` — generate-plan and ab-captions tests with mocked Anthropic
- **Created:** `backend/tests/test_v2_workflows.py` — status transitions, recycle, bulk upload, templates, migration status
- **Created:** `backend/tests/test_v2_notifications.py` — notification helper and celery schedule tests

---

### [V2-TEST-002] Frontend E2E tests — 2026-05-15
- **Created:** `frontend/e2e/post-scheduling.spec.ts` — Playwright E2E: login, new post, schedule, calendar, drafts, approval, templates, dark mode, mobile responsive
- **Created:** `frontend/playwright.config.ts` — chromium + mobile-chrome projects
