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
