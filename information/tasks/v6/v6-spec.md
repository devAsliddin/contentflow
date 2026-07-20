# V6 SPEC — Facebook integratsiya + AI Post Yaratuvchi (caption + rasm) + FB Comment Reply

> ContentFlow V6 milestone'i. Bu fayl asosiy texnik topshiriq (CLAUDE.md V6 ko'chirmasi).

## 0. SCOPE CHEGARALARI
V6 = (1) Facebook Login for Business OAuth + Page ulanishi, (2) FB Page comment auto-reply (V4 engine kengaytmasi), (3) AI Post Yaratuvchi (caption + rasm → draft → composer).

**QILINMAYDI:** ❌ Reklama/Marketing API/`ads_management` (V6.1). ❌ Video generatsiya. ❌ Avtomatik publish (faqat DRAFT). Matn-AI: V5 AIProvider layer qayta ishlatiladi (yangi matn-AI kodi yo'q). Rasm: yangi ImageProvider.

## 2. DATABASE (migratsiya `009_v6_facebook_and_ai_posts`)

### 2.1 accounts
`platform` allaqachon String(50) — `facebook` qiymati ishlatilaveradi (enum emas, ALTER kerak emas). Yangi nullable ustunlar: `fb_user_id` VARCHAR(255), `fb_page_id` VARCHAR(255), `fb_page_name` VARCHAR(255), `fb_webhook_subscribed` BOOLEAN default false, `token_status` VARCHAR(16) default 'active' (health-check uchun: active|expired). Page Access Token Fernet bilan `credentials` ichida.

### 2.2 autoreply_rules / autoreply_logs (V4, String ustunlar)
- `autoreply_rules`: `platform` VARCHAR(16) default 'instagram'; `reply_mode` VARCHAR(16) default 'template' ('template'|'ai'); `ai_context` TEXT nullable.
- `autoreply_logs`: `platform` VARCHAR(16) default 'instagram'; `reply_mode` VARCHAR(16) nullable.
- Mavjud yozuvlar 'instagram' bo'lib qoladi (server_default). Idempotency `uq_autoreply_account_object` (account_id, ig_object_id) o'zgarmaydi.

### 2.3 ai_post_drafts
id UUID PK; user_id FK→users CASCADE; account_id FK→accounts SET NULL nullable; source VARCHAR(20) ('user_idea'|'ai_recommendation'); topic_input TEXT null; caption TEXT; description TEXT null; hashtags JSONB default []; image_job_id FK→image_jobs SET NULL nullable; status VARCHAR(20) ('generating'|'ready'|'sent_to_composer'|'discarded'); generation_meta JSONB default {}; created_at/updated_at.

### 2.4 image_jobs
id UUID PK; user_id FK; draft_id FK→ai_post_drafts SET NULL nullable; image_prompt TEXT; provider VARCHAR(50); model VARCHAR(100); status VARCHAR(16) ('queued'|'generating'|'done'|'failed'); file_path TEXT null; width INTEGER; height INTEGER; error_message TEXT null; created_at/finished_at.

> ai_post_drafts.image_job_id ↔ image_jobs.draft_id o'zaro FK — circular. Migratsiyada: ikkala jadval `use_alter`/keyin `ALTER TABLE ADD CONSTRAINT` bilan yarat (yoki image_job_id FK'ni alohida `op.create_foreign_key` bilan jadvallardan keyin qo'sh). Downgrade to'liq.

Status ustunlari String (V4 uslubi) — yangi PG enum YO'Q (alembic murakkabligi va regression xavfini kamaytirish uchun). CHECK constraint ixtiyoriy.

## 3. BACKEND

### 3.1 .env (config.py + .env.example)
```
FB_APP_ID= / FB_APP_SECRET= / FB_OAUTH_REDIRECT_URI= / FB_GRAPH_VERSION=v23.0 / FB_WEBHOOK_VERIFY_TOKEN=
IMAGE_PROVIDER=cloudflare / IMAGE_FALLBACK_CHAIN=cloudflare,pollinations
CLOUDFLARE_ACCOUNT_ID= / CLOUDFLARE_API_TOKEN= / CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
POLLINATIONS_BASE_URL=https://image.pollinations.ai
IMAGE_DEFAULT_SIZE=1024x1024 / IMAGE_RATE_LIMIT_PER_USER_HOUR=10
```
`fb_app_id`/`fb_app_secret` bo'sh bo'lsa `meta_app_id_resolved`/`meta_app_secret_resolved` ga fallback (V4 patterni).

### 3.2 Facebook OAuth — `app/routers/facebook_connect.py`
- `GET /api/accounts/facebook/oauth/start` (auth, token query-param V4 IG start patterni): state→Redis(user_id,600s); redirect `https://www.facebook.com/{ver}/dialog/oauth?client_id=&redirect_uri=&state=&scope=pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_engagement,pages_manage_metadata`. **`ads_management` YO'Q.**
- `GET /api/accounts/facebook/oauth/callback`: state tekshir → code→user token (`https://graph.facebook.com/{ver}/oauth/access_token`) → long-lived (`grant_type=fb_exchange_token`) → `GET /me/accounts?fields=id,name,access_token,picture`. 1 Page → avto-ulash; ko'p → ro'yxat Redis(session_key,600s), frontend'ga `{frontend_url}/dashboard/accounts?fb_select_page={key}` redirect.
- `POST /api/accounts/facebook/select-page` (auth) body `{session_key, page_id}`: Redis ro'yxatdan Page token, Fernet bilan `accounts` upsert (platform='facebook', fb_page_id, fb_page_name, fb_user_id), webhook subscribe `POST /{page_id}/subscribed_apps?subscribed_fields=feed` → `fb_webhook_subscribed`.
- FB Graph helper'lar: `app/services/facebook_graph.py` (exchange, me/accounts, subscribe, reply_to_comment `POST /{comment_id}/comments?message=`, get_me health). `GraphAPIError` uslubi V4 kabi.

### 3.3 Facebook webhook — `app/routers/facebook_webhook.py`
- `GET /api/webhooks/facebook`: verify (`hub.verify_token`==`FB_WEBHOOK_VERIFY_TOKEN`→`hub.challenge`).
- `POST /api/webhooks/facebook`: HMAC sha256 `FB_APP_SECRET`, 200 darhol, payload→Celery `default` queue (`process_facebook_event.delay`). Faqat `feed`/`item=comment,verb=add`.

### 3.4 ImageProvider — `app/services/images/`
`base.py` (ImageProvider ABC + ImageResult: bytes, provider, model, latency_ms), `cloudflare_provider.py` (`POST https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/{model}` Bearer token; flux-1-schnell JSON `{prompt}` → base64/binary png), `pollinations_provider.py` (`GET {base}/prompt/{urlenc_prompt}?width=&height=&nologo=true&seed=`), `router.py` (`generate_image(prompt,width,height,seed)` IMAGE_FALLBACK_CHAIN, 429/5xx backoff max 3, key'siz provider skip), `storage.py` (`media_dir/ai_generated/{user_id}/{job_id}.png`, PNG, hajm tekshir). Provider nomi userga ko'rinmaydi.

### 3.5 AI Post Creator — `app/routers/ai_posts.py` (auth+ownership)
- `POST /api/ai-posts/generate` body `{account_id?, topic?, idea_from_recommendation_id?, platform_targets:[]}` — **sinxron** content AI: V5 profil(`account_profiles` so'nggi ready)+topic → 3 variant caption/description/hashtags/cta + image_prompt_seed_idea. Draft `status='ready'`. Profil yo'q → `profile_used:false`. JSON `complete_json_validated` ("content" task_type).
- `POST /api/ai-posts/{id}/regenerate-caption` body `{feedback?}`.
- `POST /api/ai-posts/{id}/generate-image`: caption→ingliz image prompt (content AI, "no text on image" default + brend rang profili) → `image_jobs` queued → `generate_image_task.delay` ('images' queue). Rate limit Redis `IMAGE_RATE_LIMIT_PER_USER_HOUR` (oshsa 429). Javob `{image_job_id}`.
- `GET /api/ai-posts/image-jobs/{job_id}`: status + done bo'lsa `image_url` (`/media/ai_generated/...`).
- `POST /api/ai-posts/{id}/regenerate-image` body `{style_hint?}`: yangi seed/prompt.
- `POST /api/ai-posts/{id}/send-to-composer`: `posts` ga draft yaratadi (caption, media_url=rasm yo'li, media_type='image', platforms=targets, status='draft'), draft `status='sent_to_composer'`, yaratilgan post_id qaytaradi.
- `GET /api/ai-posts` (pagination), `DELETE /api/ai-posts/{id}` (status='discarded').
- Schemas: `app/schemas/ai_posts.py`.
- Caption JSON: `{"variants":[{"caption","description","hashtags":[],"cta"}], "image_prompt_seed_idea"}`. IG caption ≤2200; FB description uzunroq.

## 4. CELERY

### 4.1 'images' queue — `app/tasks/image_tasks.py`
`generate_image_task(image_job_id)` queue='images': ImageRouter → storage → image_jobs done; xatoda failed+error_message. Worker `-Q default,analysis,images`.

### 4.2 FB comment reply — `app/tasks/facebook_autoreply.py` (default queue)
V4 IG engine maksimal qayta ishlatilsin. `process_facebook_event(payload)`: page_id→account(platform='facebook', fb_page_id), comment_id/from.id/text. Loop himoya (from.id==fb_page_id skip). Idempotency `uq_autoreply_account_object` (comment_id). Rule match (platform='facebook'). `reply_mode='template'`→`POST /{comment_id}/comments`. `reply_mode='ai'`→content AI (profil ton + post kontekst + komment + rule.ai_context, ≤300 belgi, guardrail: faqat biznes mavzu, narx o'ylamasin, spam/haqorat→`{"skip":true}`; JSON `{"reply","skip"}`). Rate limit Page'ga soatiga 100. autoreply_logs (platform, reply_mode yoziladi).
**IG reply_mode='ai'**: `instagram_autoreply.py` `_handle_match` ga branch — matched_rule.reply_mode=='ai' bo'lsa template o'rniga AI javob (bir xil guardrail/skip). Minimal o'zgarish, regression testlar saqlanadi.

### 4.3 Beat (`celery_app.py`, mavjudlarni o'zgartirma)
`fb_token_health_check` kunlik 03:45 (FB akkauntlar `/me` → 190 xato → token_status='expired'); `cleanup_old_image_jobs` kunlik 04:30 (30 kundan eski discarded draft rasmlari diskdan). `include` ga yangi task modullari; image task 'images' queue.

## 5. FRONTEND (React18+TS5; FB rangi #1877F2)
- 5.1 AccountsPage: "Connect with Facebook" (#1877F2), `?fb_select_page=` → Radix Dialog Page Picker → select-page → Sonner. Ulangan FB karta: Page nomi, webhook holati, Reconnect (token_status='expired').
- 5.2 Auto-reply UI: platform tab IG|FB; rule forma `reply_mode` switch (Tayyor matn|AI javob), AI→`ai_context` textarea + ogohlantirish banner; Logs'da platform+reply_mode badge.
- 5.3 `AIPostCreatorPage.tsx` `/dashboard/ai-posts/create` — 3 qadam wizard: (1) akkaunt+platform target+topic/«AI taklif» (V5 recommendations content_ideas_directions chiplar); (2) 3 caption variant radio+tahrir, hashtag chiplar, qayta yozish+feedback; (3) rasm yaratish→3s polling→preview 1:1+qayta yaratish+style_hint, «Rasmsiz davom». Yakun: «Composer'ga yuborish»→send-to-composer→composer redirect.
- 5.4 `/dashboard/ai-posts` ro'yxat (thumbnail, caption qisqartma, status badge, Davom/O'chirish).
- 5.5 Provider nomlari ko'rinmaydi; skeleton+progress; rasm xato "Rasm yaratilmadi, qayta urinib ko'ring"+retry.

## 6. DEVOPS
.env prod; Cloudflare Workers AI token yo'riqnoma; Nginx `/api/webhooks/facebook` HTTPS; `media/ai_generated/` papka+ruxsat+disk monitor 80% ogohlantirish; Celery unit `images` queue; Meta App: Facebook Login product, redirect URI, Webhooks feed subscribe, App Review pages_* materiallar.

## 7. ACCEPTANCE (Team Lead)
Spec asosidagi to'liq ro'yxat (CLAUDE.md §7). Asosiy: FB OAuth picker/avto, token Fernet, webhook idempotent+loop himoya, reply_mode='ai' IG+FB ≤300 skip, AI Post profil bilan/ulansiz, rasm async+fallback+retry, send-to-composer rasm bilan, rate limit 429, ads YO'Q, V4/V5 regression yo'q, sirlar .env.
