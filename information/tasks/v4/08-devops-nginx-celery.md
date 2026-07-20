# 08 — DevOps: Nginx + Celery + env

**Agent:** devops · **Status:** done (kod) · Meta App sozlash qoldi (konfiguratsiya)

## Nginx (`devops/nginx/contentflow.conf`)
- `location = /api/webhooks/instagram` — **rate-limit'siz** alohida location, `/api`
  (60r/min) dan oldin. Sabab: Meta hodisalarni burst qiladi va non-2xx javobda
  subscription'ni o'chiradi. Imzo FastAPI'da tekshiriladi; raw body nginx default'da
  o'zgartirilmaydi (HMAC uchun shart).
- HTTPS majburiy (Let's Encrypt allaqachon sozlangan).

## Celery
- `celery_app.py` `include` ga `app.tasks.instagram_autoreply` qo'shildi.
- Beat schedule: `refresh-instagram-tokens` (kunlik 03:00 UTC) →
  `contentflow.refresh_instagram_tokens`.
- Yangi systemd service shart emas — mavjud `contentflow-celery` / `-beat` yetarli.
  `.env` yangilangach: `systemctl restart contentflow-backend contentflow-celery contentflow-celery-beat`.

## ENV (`.env.example` yangilandi)
`META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_OAUTH_REDIRECT_URI`,
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_GRAPH_VERSION=v23.0`.

## Bir martalik qo'lda sozlash (loyiha egasi — spec §7)
1. Meta Developer App (Business) → App ID/Secret → `.env`.
2. Instagram product → "API setup with Instagram login" → OAuth Redirect URI qo'shish.
3. Webhooks → Callback URL `https://DOMEN/api/webhooks/instagram`, Verify Token =
   `.env` dagi qiymat → Verify and Save → `messages`, `comments` ga subscribe.
4. App Review: `instagram_business_basic`, `..._manage_messages`, `..._manage_comments`
   (production uchun; bir necha kun davom etishi mumkin).
