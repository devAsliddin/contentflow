# ContentFlow DevOps

## Quick Start

### 1. First-time VPS setup
```bash
scp devops/scripts/setup_vps.sh root@YOUR_VPS_IP:/tmp/
ssh root@YOUR_VPS_IP "bash /tmp/setup_vps.sh"
```

### 2. Configure environment
```bash
sudo nano /etc/contentflow/.env
# Fill in all values from backend/.env.example
```

### 3. Clone and deploy
```bash
cd /var/www/contentflow
git clone YOUR_GITHUB_REPO .
bash devops/scripts/deploy.sh
```

### 4. Install systemd services
```bash
sudo cp devops/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-backend contentflow-celery
sudo systemctl start contentflow-backend contentflow-celery
```

### 5. Configure Nginx
```bash
sudo cp devops/nginx/contentflow.conf /etc/nginx/sites-available/contentflow
sudo ln -s /etc/nginx/sites-available/contentflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Set up backup cron
```bash
echo "0 2 * * * contentflow bash /var/www/contentflow/devops/scripts/backup.sh" | sudo tee -a /etc/crontab
```

## Service Management

```bash
# Status
sudo systemctl status contentflow-backend
sudo systemctl status contentflow-celery

# Logs
journalctl -u contentflow-backend -f
journalctl -u contentflow-celery -f

# Restart all
bash devops/scripts/restart_services.sh
```

---

## V5 Deploy: AI Analyst — Production Setup

### New .env variables checklist

Add the following to `/etc/contentflow/.env` before restarting services.
All values are required unless marked optional.

```
# ── V5: AI Provider routing (free-first) ─────────────────────────────────────
AI_ANALYSIS_PROVIDER=groq
AI_CLASSIFICATION_PROVIDER=vllm
AI_CONTENT_PROVIDER=groq
AI_FALLBACK_CHAIN=groq,openrouter,vllm

# Groq — REQUIRED for analysis/recommendations/content ideas
GROQ_API_KEY=gsk_...            # see "GROQ_API_KEY how to obtain" below
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_MAX_RETRIES=5

# vLLM — self-hosted caption classification (optional; fallback=Groq if down)
VLLM_BASE_URL=http://127.0.0.1:8000/v1
VLLM_MODEL=Qwen2.5-7B-Instruct

# OpenRouter — second fallback (optional, free tier)
OPENROUTER_API_KEY=             # leave blank to skip this fallback step
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Anthropic — stub, not routed yet; set for future upgrade
ANTHROPIC_API_KEY=
ANTHROPIC_ANALYSIS_MODEL=claude-sonnet-4-20250514

# Analysis tuning
ANALYSIS_MEDIA_LIMIT=50
ANALYSIS_CLASSIFY_CHUNK_SIZE=10
```

### GROQ_API_KEY — how to obtain

1. Go to https://console.groq.com and sign in (free Google account works).
2. In the left menu: **API Keys** → **Create API Key**.
3. Give it a name (e.g. `contentflow-prod`) and copy the key immediately —
   it is shown only once.
4. Paste the key into `/etc/contentflow/.env`: `GROQ_API_KEY=gsk_...`
5. Free tier limits (as of 2026): ~1K–14K requests/day depending on model,
   ~30 requests/minute. The V5 analysis chain uses at most ~8–10 LLM calls
   per account, so the free tier covers normal usage comfortably.
6. If you hit the daily limit (Groq returns 429 consistently), the Celery task
   retries with exponential backoff and logs a WARNING. The job status shows
   "queued" and the frontend shows "Tahlil navbatda" — no crash.

### V5 restart sequence

After editing `/etc/contentflow/.env`:

```bash
# 1. Install the new analysis worker unit (first deploy only)
sudo cp devops/systemd/contentflow-celery-analysis.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-celery-analysis

# 2. Restart all affected services
sudo systemctl restart contentflow-backend
sudo systemctl restart contentflow-celery
sudo systemctl restart contentflow-celery-analysis
sudo systemctl restart contentflow-celery-beat
sudo systemctl reload nginx

# 3. Verify all units are active
sudo systemctl status contentflow-backend contentflow-celery \
    contentflow-celery-analysis contentflow-celery-beat --no-pager
```

### Celery Beat — V5 scheduled tasks

Beat unit (`contentflow-celery-beat.service`) does NOT change. The new
periodic tasks (`daily_account_snapshot` at 03:00, `weekly_refresh` on
Mondays at 04:00) are registered inside `app/tasks/celery_app.py`. Beat
picks them up automatically on restart — no unit file edits needed.

**Action required after deploy:** `sudo systemctl restart contentflow-celery-beat`

### Queue separation: why two Celery workers

| Unit | Queue | Concurrency | Purpose |
|------|-------|-------------|---------|
| `contentflow-celery` | `celery` (default) | 4 | Auto-reply DMs, webhooks, fast tasks |
| `contentflow-celery-analysis` | `analysis` | 2 | AI analysis chain (slow, LLM calls) |

This prevents long-running AI tasks from blocking auto-reply message handling.

### vLLM health check

Check manually:
```bash
bash devops/scripts/check_vllm.sh
```

Set up automated monitoring every 5 minutes via cron:
```bash
echo "*/5 * * * * contentflow bash /var/www/contentflow/devops/scripts/check_vllm.sh >> /var/log/contentflow/check_vllm.log 2>&1" \
  | sudo tee -a /etc/crontab
```

Or use the systemd timer example documented inside `devops/scripts/check_vllm.sh`.

### Fallback chain smoke test (vLLM down scenario)

```bash
# With vLLM stopped, run:
export TEST_TOKEN=<jwt_token>
export TEST_ACCOUNT_ID=<uuid>
bash devops/scripts/smoke_ai_fallback.sh
```

Confirms: stats work without AI; analysis enqueues; unauthenticated requests
return 401 not 500. See the script's inline comments for full step descriptions.

### Log locations

| Service | Log file |
|---------|----------|
| Backend | `/var/log/contentflow/access.log`, `error.log` |
| Celery default worker | `/var/log/contentflow/celery.log` |
| Celery analysis worker | `/var/log/contentflow/celery-analysis.log` |
| Celery beat | `/var/log/contentflow/celery-beat.log` |
| vLLM health check | `/var/log/contentflow/check_vllm.log` |

---

## V6 Deploy: Facebook Integration + AI Post Creator

### New .env variables checklist

Add the following to `/etc/contentflow/.env` before restarting services.

```
# ── V6: Facebook OAuth + Webhooks ─────────────────────────────────────────────
# Uses FB_APP_ID / FB_APP_SECRET; falls back to META_APP_ID/SECRET if left blank.
FB_APP_ID=                         # from Meta Developer dashboard (same App as Instagram)
FB_APP_SECRET=                     # App Secret — keep secret, never commit
# Must EXACTLY match the redirect URI registered in the Meta app dashboard:
#   Products → Facebook Login → Settings → Valid OAuth Redirect URIs
FB_OAUTH_REDIRECT_URI=https://YOUR_DOMAIN/api/accounts/facebook/oauth/callback
FB_GRAPH_VERSION=v23.0             # bump when Meta deprecates the current version
# Any random secret string — must match "Verify Token" entered in Meta → Webhooks
FB_WEBHOOK_VERIFY_TOKEN=           # generate: python3 -c "import secrets; print(secrets.token_hex(24))"

# ── V6: Image Generation ───────────────────────────────────────────────────────
# Primary provider + fallback chain (provider names: cloudflare, pollinations)
IMAGE_PROVIDER=cloudflare
IMAGE_FALLBACK_CHAIN=cloudflare,pollinations

# Cloudflare Workers AI — see "CLOUDFLARE_API_TOKEN — how to obtain" below
CLOUDFLARE_ACCOUNT_ID=             # 32-char hex; from dash.cloudflare.com URL
CLOUDFLARE_API_TOKEN=              # Workers AI API token
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell

# Pollinations.ai — FREE, no API key required. Leave POLLINATIONS_BASE_URL as-is.
POLLINATIONS_BASE_URL=https://image.pollinations.ai

# Image dimensions and rate limit
IMAGE_DEFAULT_SIZE=1024x1024
IMAGE_RATE_LIMIT_PER_USER_HOUR=10
```

### CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID — how to obtain

**Account ID:**
1. Log in to https://dash.cloudflare.com
2. Select any domain (or the home page if you have no domains).
3. In the right sidebar under **API** you will see **Account ID** — copy the 32-character hex string.
4. Alternatively: the URL of your dashboard is `https://dash.cloudflare.com/<ACCOUNT_ID>/...` — the segment after the domain is your Account ID.

**API Token (Workers AI):**
1. In the Cloudflare dashboard: top-right avatar → **My Profile** → **API Tokens**.
2. Click **Create Token**.
3. Use the **"Workers AI" template** (or create a Custom Token with permission `Account > Workers AI > Edit`).
4. Under **Account Resources**: select your account.
5. Click **Continue to summary** → **Create Token**.
6. Copy the token immediately — it is shown only once.
7. Paste it into `/etc/contentflow/.env`: `CLOUDFLARE_API_TOKEN=<token>`

**Pollinations.ai:** No API key needed. It is a free public API with no authentication. The fallback chain uses it automatically when Cloudflare fails or is not configured.

**Free tier limits (Cloudflare Workers AI, as of 2026):** 10,000 "Neurons" per day on the free plan. `flux-1-schnell` costs approximately 500 Neurons per image, giving ~20 free images/day. If exceeded, the fallback chain switches to Pollinations automatically.

### CLOUDFLARE_ACCOUNT_ID from dashboard URL

Example dashboard URL:
```
https://dash.cloudflare.com/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4/workers-and-pages
                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                            This 32-char hex is your CLOUDFLARE_ACCOUNT_ID
```

### Celery 'images' queue — new worker unit

A separate worker unit processes image generation tasks (10–120 seconds each).
Keeping it isolated prevents slow image jobs from blocking auto-reply webhooks.

| Unit | Queue | Concurrency | Purpose |
|------|-------|-------------|---------|
| `contentflow-celery` | `celery` (default) | 4 | Auto-reply, webhooks, fast tasks |
| `contentflow-celery-analysis` | `analysis` | 2 | AI analysis chain (slow LLM calls) |
| `contentflow-celery-images` | `images` | 2 | AI image generation (Cloudflare/Pollinations) |

**First deploy only — install the new unit:**

```bash
sudo cp devops/systemd/contentflow-celery-images.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-celery-images
```

### V6 restart sequence

After editing `/etc/contentflow/.env`:

```bash
# 1. Create media/ai_generated directory and set permissions (first deploy only)
sudo mkdir -p /var/www/contentflow/media/ai_generated
sudo chown contentflow:www-data /var/www/contentflow/media/ai_generated
sudo chmod 750 /var/www/contentflow/media/ai_generated

# 2. Install the images worker unit (first deploy only)
sudo cp devops/systemd/contentflow-celery-images.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contentflow-celery-images

# 3. Restart all services
sudo systemctl restart contentflow-backend
sudo systemctl restart contentflow-celery
sudo systemctl restart contentflow-celery-analysis
sudo systemctl restart contentflow-celery-images
sudo systemctl restart contentflow-celery-beat
sudo systemctl reload nginx

# 4. Verify all units are active
sudo systemctl status contentflow-backend contentflow-celery \
    contentflow-celery-analysis contentflow-celery-images \
    contentflow-celery-beat --no-pager
```

### media/ai_generated/ — disk monitor

AI-generated PNG images can accumulate on disk. The cleanup Beat task
(`cleanup_old_image_jobs`, daily at 04:30) removes files older than 30 days.
Use `check_disk.sh` for proactive threshold monitoring:

```bash
# Manual check
bash devops/scripts/check_disk.sh

# Install hourly cron (logs to /var/log/contentflow/check_disk.log)
echo "0 * * * * contentflow bash /var/www/contentflow/devops/scripts/check_disk.sh >> /var/log/contentflow/check_disk.log 2>&1" \
  | sudo tee -a /etc/crontab
```

Alerts (>80% usage) are also written to `/var/log/contentflow/disk_alert.log`.

### Nginx — Facebook webhook

The `/api/webhooks/facebook` endpoint is handled by an exact-match `location`
in `devops/nginx/contentflow.conf` (same pattern as the Instagram webhook):

- No rate limiting — Meta bursts webhook events in batches; rate limiting
  causes non-2xx responses which disable the Meta subscription.
- Raw body passes through unmodified — HMAC-SHA256 verification
  (`X-Hub-Signature-256`) is performed in FastAPI.
- The exact-match block `location = /api/webhooks/facebook` takes priority
  over the general `location /api` block, so the FB webhook bypasses the
  `api_limit` rate limiting zone automatically.

No additional Nginx config action is needed — `contentflow.conf` already
contains the block. After `nginx -t` passes, reload: `sudo systemctl reload nginx`.

### Meta App setup — Facebook Login + Webhooks

Follow these steps in the Meta Developer dashboard (https://developers.facebook.com).
Use the **same App** that already has Instagram configured (V4), or create a new one.

#### Step 1 — Add Facebook Login product

1. Open your App → **Add a product** → find **Facebook Login** → **Set up**.
2. Choose **Web** as the platform.
3. Under **Facebook Login → Settings**:
   - **Valid OAuth Redirect URIs**: add `https://YOUR_DOMAIN/api/accounts/facebook/oauth/callback`
     (must match `FB_OAUTH_REDIRECT_URI` in `.env` exactly, including scheme and path).
   - **Allowed Domains**: add your production domain.
   - Save changes.

#### Step 2 — Configure required permissions

Your App must request these scopes during OAuth (already coded in the backend):
- `pages_show_list` — list Pages the user manages
- `pages_read_engagement` — read Page engagement (comments, reactions)
- `pages_read_user_content` — read Page posts and comments
- `pages_manage_engagement` — reply to comments on behalf of the Page
- `pages_manage_metadata` — subscribe to Page webhooks

**`ads_management` is NOT requested** (V6.1 scope, excluded by design).

#### Step 3 — Set up Webhooks for Page feed

1. App dashboard → **Products** → **Webhooks** → **Add Subscriptions**.
2. Select object type: **Page**.
3. **Callback URL**: `https://YOUR_DOMAIN/api/webhooks/facebook`
4. **Verify Token**: the value you set for `FB_WEBHOOK_VERIFY_TOKEN` in `.env`.
5. Click **Verify and Save** — Meta sends a GET request; FastAPI returns the
   `hub.challenge` value. Nginx must already be reloaded with the new config.
6. Under **Page subscription fields**, enable: **`feed`** (covers new comments
   on Page posts, which is what the auto-reply engine processes).
7. Click **Save**.

Note: The per-page webhook subscription (`POST /{page_id}/subscribed_apps?subscribed_fields=feed`)
is also performed programmatically when the user connects a Page via OAuth
(`select-page` endpoint). The Meta dashboard step above registers the App-level
callback; the programmatic call subscribes the specific Page.

#### Step 4 — App Review (for `pages_*` permissions)

Meta requires App Review before `pages_manage_engagement` and
`pages_manage_metadata` can be used by users who are not App admins/testers.

**Required materials for each permission:**

| Permission | What to provide |
|---|---|
| `pages_show_list` | Screen recording: user clicks "Connect Facebook", OAuth flow completes, Page appears in ContentFlow accounts list. |
| `pages_read_engagement` | Screen recording: auto-reply rule triggers, comment reply visible in Facebook. |
| `pages_read_user_content` | Screen recording: comment content appears in ContentFlow logs. |
| `pages_manage_engagement` | Screen recording: reply posted to a real Page comment (use a test Page). Explain use case: comment auto-reply for business Pages. |
| `pages_manage_metadata` | Screen recording: webhook subscription confirmed, feed events received. Explain: receives comment events for auto-reply. |

**Test Page:** Create a dedicated Facebook Page for testing (not your real business Page).
Use it for all screen recordings. Meta reviewers expect to see a real Page, not a personal profile.

**Privacy Policy URL** and **App Icon** must be filled in under **App Settings → Basic**
before submitting for review.

**Submission steps:**
1. App dashboard → **App Review** → **Requests**.
2. Add each `pages_*` permission individually.
3. For each: select **use case**, attach screen recording, write a plain-language
   description of why ContentFlow needs this permission.
4. Submit. Review typically takes 5–10 business days.

During review (and for internal testing), add test users via **Roles → Test Users**.
Test users can use the full OAuth + webhook flow without App Review approval.

### Log locations (V6 additions)

| Service | Log file |
|---------|----------|
| Celery images worker | `/var/log/contentflow/celery-images.log` |
| Disk usage monitor | `/var/log/contentflow/check_disk.log` |
| Disk alert threshold | `/var/log/contentflow/disk_alert.log` |
