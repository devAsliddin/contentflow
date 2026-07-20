# V6 — Facebook integratsiya + AI Post Yaratuvchi + FB Comment Reply

To'liq spec: ushbu papkadagi `v6-spec.md` (CLAUDE.md V6 ko'chirmasi).

## Uchta blok
1. Facebook Login for Business OAuth + Page tanlash (reklama V6.1 ga — hozir YO'Q).
2. Facebook Page comment auto-reply (V4 rule engine kengaytmasi) + `reply_mode='ai'` (IG'da ham).
3. AI Post Yaratuvchi — caption (V5 AIProvider) + rasm (yangi ImageProvider) → draft → composer.

## Ish tartibi (dependency chain)
| # | Agent | Task fayl | Status |
|---|-------|-----------|--------|
| 1 | database | `v6_database.md` | `status/database.json` |
| 2 | backend | `v6_backend.md` | `status/backend.json` |
| 3 | celery | `v6_celery.md` | `status/celery.json` |
| 4 | frontend | `v6_frontend.md` | `status/frontend.json` |
| 5 | devops | `v6_devops.md` | `status/devops.json` |

## Qat'iy cheklovlar
- ❌ Ads/Marketing API, `ads_management` scope — YO'Q (V6.1).
- ❌ Video generatsiya — faqat rasm. ❌ Avtomatik publish — faqat DRAFT.
- Matn-AI: V5 `app/services/ai/` qayta ishlatiladi, yangi matn-AI kodi yozilmaydi.
- V4 (IG auto-reply, OAuth, webhook) va V5 (AI tahlil, AIProvider, analysis queue) regression TAQIQLANGAN.
- Sirlar faqat `.env`; tokenlar Fernet bilan; provider almashtirish faqat config.
- Frontend'da provider nomlari (Groq, Cloudflare, Flux, Pollinations) ko'rinmaydi — faqat "AI".

## Mavjud kod realiyalari (agentlar e'tibor bersin)
- Migratsiya head: **008** → yangi **009_v6_facebook_and_ai_posts**.
- `accounts` modeli: `app/models/account.py` — `platform` String(50), `credentials` Fernet JSON, `ig_user_id`, `ig_webhook_subscribed` bor. Token shu `credentials` ichida.
- `autoreply_rules`/`autoreply_logs`: `app/models/autoreply.py` — **ENUM emas, String ustunlar**. Idempotency: `uq_autoreply_account_object` = (account_id, ig_object_id). FB uchun ham shu ishlatiladi (comment_id = ig_object_id, account-scoped).
- `posts`: `app/models/post.py` — `caption`, `media_url` (bitta String), `media_type` ('image'|'video'), `platforms` JSON list `["instagram:acc_id"]`, `status` 'draft'.
- Media: `/media` StaticFiles mount (`app/main.py`), `settings.media_dir`. AI rasmlar `media_dir/ai_generated/{user_id}/{job_id}.png` → `/media/ai_generated/...`.
- AI: `app/services/ai/router.py` `complete_for_task(task_type, ...)` — task_type'lar: analysis|classification|**content**. Caption/image-prompt/ai-reply uchun **content** ishlatiladi. JSON: `app/services/ai/json_utils.py` `complete_json_validated`.
- Webhook signature util: `app/routers/instagram_webhook.py` (HMAC sha256). FB uchun bir xil mantiq, `FB_APP_SECRET` bilan.
- Router registratsiya: `app/main.py`.
