# 02 — Backend: Instagram OAuth connect

**Agent:** backend · **Status:** done

## Endpointlar (`app/routers/instagram_connect.py`, prefix `/api/accounts/instagram`)
- **`GET /oauth/start`** — `state` (CSRF) generatsiya, Redis'ga 10 daqiqaga saqlash,
  instagram.com authorize sahifasiga 302. Scope:
  `instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments`.
  > Eslatma: bu **to'liq sahifa redirect** (window.location), shuning uchun JWT
  > Authorization header sifatida yuborilmaydi — `?token=` query param sifatida
  > qabul qilinadi va `decode_token` bilan tekshiriladi (`get_current_user` kabi).
- **`GET /oauth/callback`** — `state` tekshiruvi → code→short-lived→long-lived (60 kun)
  token → `GET /me` (user_id, username) → webhook subscribe (best-effort) → Fernet
  bilan shifrlab `accounts`'ga upsert (`ig_user_id` bilan) → frontend `/dashboard/autoreply?connected=instagram`.

## Token yangilash
Celery Beat kunlik (`03:00 UTC`) `contentflow.refresh_instagram_tokens` — 50 kundan
eski tokenlarni `ig_refresh_token` bilan yangilaydi (`token_issued_at` credentials
ichida saqlanadi). Kod: `app/tasks/beat_tasks.py`.

## Graph API client
`app/services/instagram_graph.py` — `exchange_code_for_token`, `exchange_for_long_lived`,
`refresh_long_lived`, `get_me`, `subscribe_webhook`. `GraphAPIError(status_code, detail)`
retry qarorini osonlashtiradi.

## Config (`app/config.py`)
`meta_app_id`, `meta_app_secret` (bo'sh bo'lsa `instagram_app_id/secret`'ga fallback),
`instagram_oauth_redirect_uri`, `instagram_webhook_verify_token`, `instagram_graph_version`.
