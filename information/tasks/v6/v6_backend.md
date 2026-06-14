# V6 Backend Agent — FB OAuth/webhook, ImageProvider, AI Post Creator

> Spec: `v6-spec.md` §3. Database agent tugagan (009 migratsiya, `app/models/ai_posts.py`, accounts/autoreply yangi ustunlar). Tugagach `status/backend.json` yangila.

## Kontekst (mavjud kod — o'rgan)
- `app/config.py` — pydantic Settings. Yangi env shu yerga + `contentflow/.env.example` ga.
- `app/services/encryption.py` — `encrypt_credentials`/`decrypt_credentials` (Fernet).
- `app/services/instagram_graph.py` — Graph client + `GraphAPIError` patterni (FB uchun shu uslub).
- `app/routers/instagram_connect.py` — OAuth start (token query-param + decode_token), state→Redis, callback upsert. FB OAuth shu patternda.
- `app/routers/instagram_webhook.py` — HMAC sha256 verify + 200 fast + Celery enqueue. FB webhook shu patternda, `FB_APP_SECRET`.
- `app/services/ai/router.py` `complete_for_task(task_type=...)` ("content" task_type), `app/services/ai/json_utils.py` `complete_json_validated(...)`. **Yangi matn-AI kodi yozma** — "content" ni qayta ishlat.
- `app/routers/analysis.py` — auth+ownership pattern (`get_current_user`, account.user_id tekshir), Redis rate limit namunasi.
- `app/models/post.py` — `Post` (media_url single, media_type, platforms JSON, status). send-to-composer shuni yaratadi.
- `app/main.py` — router registratsiya + `/media` StaticFiles mount, `settings.media_dir`.

## Vazifalar
1. **config.py + .env.example**: spec §3.1 barcha o'zgaruvchilar. `fb_app_id`/`fb_app_secret` uchun `meta_*_resolved` kabi fallback property qo'sh (bo'sh bo'lsa meta'dan). `image_default_size` ni `(w,h)` ga parse qiluvchi property.
2. **`app/services/facebook_graph.py`**: `exchange_code_for_token`, `exchange_for_long_lived` (`grant_type=fb_exchange_token`), `get_user_pages` (`/me/accounts?fields=id,name,access_token,picture`), `subscribe_page_webhook` (`POST /{page_id}/subscribed_apps?subscribed_fields=feed`), `reply_to_comment` (`POST /{comment_id}/comments?message=`), `check_token` (`/me` → 190 detect). Base `https://graph.facebook.com/{fb_graph_version}`. `GraphAPIError` (IG'nikini import yoki shu faylda).
3. **`app/routers/facebook_connect.py`** (spec §3.2): start/callback/select-page. Redis kalitlar `fb_oauth:state:{state}`, `fb_pages:{session_key}`. 1 Page avto, ko'p → frontend redirect `?fb_select_page=`. Token Fernet bilan `credentials`. Hech qachon token log qilma.
4. **`app/routers/facebook_webhook.py`** (spec §3.3): GET verify, POST HMAC+200+enqueue `process_facebook_event` (lazy import, try/except).
5. **`app/services/images/`** (spec §3.4): base.py, cloudflare_provider.py, pollinations_provider.py, router.py (`generate_image(...)` fallback chain, key'siz skip), storage.py (`media_dir/ai_generated/{user_id}/{job_id}.png`). httpx timeout 120s, 429/5xx backoff max 3.
6. **`app/schemas/ai_posts.py`** + **`app/routers/ai_posts.py`** (spec §3.5): 8 endpoint. Caption JSON `complete_json_validated` ("content"). Image prompt generatsiyasi ham "content" (ingliz, "no text on image"). Rate limit Redis `image_gen:{user_id}` soatiga `IMAGE_RATE_LIMIT_PER_USER_HOUR`. Celery task lazy import (`from app.tasks.image_tasks import generate_image_task`). send-to-composer → `Post` draft (media_url=`/media/ai_generated/...`, media_type='image', platforms=`[f"{p}:{account_id}"]` yoki targets bo'yicha, status='draft').
7. **main.py**: `facebook_connect` (`prefix="/api/accounts/facebook"`), `facebook_webhook` (`prefix="/api/webhooks"`), `ai_posts` (`prefix="/api/ai-posts"`) ulanadi.

## Cheklovlar
- Hech qanday ads/Marketing API kodi, `ads_management` scope YO'Q.
- Sirlar kodda yo'q; tokenlar Fernet; provider almashtirish faqat config.
- Celery task'lar (image_tasks, facebook_autoreply) keyingi agent yozadi — bu yerda faqat lazy `.delay()`.

## Tekshiruv
- `venv\Scripts\python.exe -c "from app.main import app; print('OK')"`.
- `httpx` allaqachon bor. Yangi dependency kerak bo'lmasligi kerak (base64/Pillow kerak bo'lsa: Pillow requirements'da bormi tekshir, faqat hajm/format uchun kerak bo'lsa qo'sh).
- `venv\Scripts\python.exe -m pytest tests -q` regression.

Status JSON: `status/backend.json`.
