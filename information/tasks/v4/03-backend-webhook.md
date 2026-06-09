# 03 — Backend: Webhook

**Agent:** backend · **Status:** done

## Endpointlar (`app/routers/instagram_webhook.py`, prefix `/api/webhooks`)
- **`GET /instagram`** — Meta verification handshake. `hub.mode==subscribe` va
  `hub.verify_token == INSTAGRAM_WEBHOOK_VERIFY_TOKEN` bo'lsa `hub.challenge` ni
  `text/plain` 200 qaytaradi, aks holda 403.
- **`POST /instagram`** — hodisa qabul qilish:
  1. **Raw body** olinadi (`await request.body()`), `X-Hub-Signature-256` header
     `META_APP_SECRET` bilan HMAC-SHA256 hisoblanib `hmac.compare_digest` orqali
     solishtiriladi. Mos kelmasa **403**.
  2. Imzo to'g'ri bo'lsagina JSON parse qilinadi.
  3. `process_instagram_event.delay(payload)` — Celery'ga uzatiladi.
  4. **Darhol `200 OK`** (`text/plain`) qaytariladi. Enqueue xatosi bo'lsa ham 200
     qaytariladi (Meta webhook'ni o'chirmasligi uchun), xato log qilinadi.

## Muhim
- Imzo tekshiruvi raw body talab qiladi — middleware/CORS body'ni o'zgartirmaydi.
- Nginx'da `/api/webhooks/instagram` alohida location, rate-limit'siz (04→08 ga qarang).
- DM va comment payloadlari farqli (`messaging[]` vs `changes[]`) — Celery task ikkalasini parse qiladi (05).
