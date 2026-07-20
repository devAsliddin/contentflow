# V4 — Instagram Avtomatik Javob (DM + Comment)

Instagram Business/Creator akkauntlariga kelgan **Direct Message** va **post
commentlariga** kalit so'z / qoida asosida avtomatik javob berish.

## Asosiy prinsip
- **Parol HECH QACHON ishlatilmaydi va saqlanmaydi.** Faqat Instagram OAuth →
  long-lived access token (Fernet bilan shifrlangan).
- Faqat **Instagram Graph API (Messaging) + Webhook**. Selenium/Playwright/userbot YO'Q.

## Oqim
```
Instagram → Webhook (POST /api/webhooks/instagram)
  → imzo tekshiruvi (X-Hub-Signature-256)
  → 200 OK darhol
  → Celery: process_instagram_event
      → loop himoyasi → akkaunt topish → qoida match → rate-limit → Graph API javob
      → autoreply_logs
```

## Implementatsiya holati (2026-06-08)
Barcha 8 task `done`. Qolgan yagona qadam — **Meta Developer App sozlash va App
Review** (kod emas, konfiguratsiya): `08`-task va asosiy spec §7 ga qarang.

| # | Task | Agent | Status |
|---|------|-------|--------|
| 01 | DB: autoreply_rules + autoreply_logs + accounts ustunlari | database | done |
| 02 | Backend: Instagram OAuth connect | backend | done |
| 03 | Backend: Webhook (verify + receive) | backend | done |
| 04 | Backend: Rules CRUD + logs | backend | done |
| 05 | Celery: auto-reply logikasi | backend | done |
| 06 | Frontend: Rules UI (sahifa + editor) | frontend | done |
| 07 | Frontend: Connect + Logs panel | frontend | done |
| 08 | DevOps: Nginx + Celery beat + env | devops | done (App sozlash qoldi) |

## Migratsiya
```bash
cd backend && alembic upgrade head   # 007_v4_autoreply
```

## Asosiy fayllar
- Backend: `app/models/autoreply.py`, `app/schemas/autoreply.py`,
  `app/services/instagram_graph.py`, `app/routers/{instagram_connect,instagram_webhook,autoreply}.py`,
  `app/tasks/instagram_autoreply.py`, `alembic/versions/007_v4_autoreply.py`
- Frontend: `src/components/autoreply/*`, `src/services/autoreply.service.ts`,
  `src/types/autoreply.types.ts`
- DevOps: `devops/nginx/contentflow.conf`, `.env.example`
