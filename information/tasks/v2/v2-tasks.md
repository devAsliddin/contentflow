# ContentFlow V2 — Task List

**Version:** 2.0.0
**Start:** 2026-05-12
**Muddat:** 6-8 hafta

---

## Analytics (ANA)

- [x] **V2-ANA-001** [Backend] — Post performance dashboard API: likes, views, reach per post. Endpoint: `GET /api/v2/analytics/posts`
- [x] **V2-ANA-002** [Backend] — Platform comparison endpoint: TG vs IG vs TikTok bar/line chart data. Endpoint: `GET /api/v2/analytics/platforms`
- [x] **V2-ANA-003** [Backend] — Follower growth dynamics: store + return follower count snapshots over time. Endpoint: `GET /api/v2/analytics/followers`
- [ ] **V2-ANA-004** [Backend] — Weekly auto PDF report: generate PDF via WeasyPrint/ReportLab, send via email or Telegram. Endpoint: `POST /api/v2/analytics/report`
- [ ] **V2-ANA-005** [Backend] — Best posting time AI analysis: analyze post performance by hour/day, return optimal slots. Endpoint: `GET /api/v2/analytics/best-time`

## AI Assistant (AI)

- [x] **V2-AI-001** [Backend] — Caption Rewriter: takes caption + target platform, rewrites for that platform's style/limits. Endpoint: `POST /api/v2/ai/rewrite-caption`
- [ ] **V2-AI-002** [Backend] — Hashtag Suggester: trending + niche hashtags based on caption/topic. Endpoint: `POST /api/v2/ai/hashtags`
- [ ] **V2-AI-003** [Backend] — Post tone analyzer: returns tone score (professional/casual/fun). Endpoint: `POST /api/v2/ai/analyze-tone`
- [ ] **V2-AI-004** [Backend] — Weekly content plan generator v2: improved prompt, includes hashtags + best time suggestions. Endpoint: `POST /api/v2/ai/generate-plan`
- [ ] **V2-AI-005** [Backend] — A/B caption variant generator: returns 2-3 caption variants for testing. Endpoint: `POST /api/v2/ai/ab-captions`

## Workflow (WF)

- [ ] **V2-WF-001** [Backend+Frontend] — Draft Queue: posts saved as `draft` status, dedicated draft list UI. `GET /api/v2/posts?status=draft`
- [ ] **V2-WF-002** [Backend+Frontend] — Approval Flow: post states: draft → pending_review → approved → published. Role-based review endpoint.
- [ ] **V2-WF-003** [Backend+Frontend] — Repost/Recycle: select old published post, re-schedule it. `POST /api/v2/posts/{id}/recycle`
- [ ] **V2-WF-004** [Backend+Frontend] — Bulk Upload: accept multiple files in one request (up to 10). `POST /api/v2/upload/bulk`
- [ ] **V2-WF-005** [Frontend] — Post template library: save/load caption templates. Local storage + `POST /api/v2/templates`

## Auth / OAuth2 (ACC)

- [x] **V2-ACC-001** [Backend] — Instagram Graph API OAuth2: full OAuth2 flow (authorize → callback → token exchange → store). Endpoints: `GET /api/v2/oauth/instagram/authorize`, `GET /api/v2/oauth/instagram/callback`
- [x] **V2-ACC-002** [Backend] — TikTok Login Kit OAuth2: full OAuth2 flow. Endpoints: `GET /api/v2/oauth/tiktok/authorize`, `GET /api/v2/oauth/tiktok/callback`
- [ ] **V2-ACC-003** [Backend+Frontend] — Migrate username/password account sessions to OAuth2 tokens. Migration script + UI prompt for reconnection.

## Notifications (NOT)

- [ ] **V2-NOT-001** [Backend] — Success notification: Telegram bot message when post publishes. Hook into post_tasks.py on success.
- [ ] **V2-NOT-002** [Backend] — Error notification: Telegram bot message with error details when post fails. Hook into post_tasks.py on failure.
- [ ] **V2-NOT-003** [Backend] — Weekly analytics summary via Telegram: scheduled Celery beat task every Monday 9am.

## UI/UX (UI)

- [x] **V2-UI-001** [Frontend] — New Dashboard: analytics charts (Recharts), real reach/engagement data, upcoming posts panel v2.
- [ ] **V2-UI-002** [Frontend] — Multi-account sidebar: quick account switcher, show active account avatar + name.
- [ ] **V2-UI-003** [Frontend] — Content Calendar v2: monthly view with drag-and-drop rescheduling.
- [ ] **V2-UI-004** [Frontend] — Mobile-responsive design: all pages work on 375px+ screens.
- [ ] **V2-UI-005** [Frontend] — Dark mode toggle: persisted in localStorage, smooth transition.

## Infrastructure (INFRA)

- [ ] **V2-INFRA-001** [Backend] — PostgreSQL index optimization: add indexes on `scheduled_at`, `status`, `platform`, `user_id` combinations.
- [ ] **V2-INFRA-002** [Backend] — Redis cache for analytics: cache analytics endpoints for 1 hour with cache invalidation on new posts.
- [ ] **V2-INFRA-003** [DevOps] — Media CDN: configure Nginx to serve /media/ with aggressive caching, optional S3/R2 integration.

## Tests (TEST)

- [ ] **V2-TEST-001** [Backend] — Unit tests: pytest tests for all V2 endpoints (ANA, AI, WF, ACC, NOT, INFRA).
- [ ] **V2-TEST-002** [Frontend] — E2E test: full post scheduling flow (create → schedule → published) using Playwright.
