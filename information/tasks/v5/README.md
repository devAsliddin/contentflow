# V5 — Instagram AI SMM Tahlilchi

To'liq spec: `v5-spec.md`. Free-first AI (Groq/vLLM/OpenRouter), provider-agnostic abstraction.

## Ish tartibi (dependency chain)

| # | Agent | Task fayl | Status |
|---|-------|-----------|--------|
| 1 | database | `v5_database.md` | `status/database.json` |
| 2 | backend | `v5_backend.md` | `status/backend.json` |
| 3 | celery | `v5_celery.md` | `status/celery.json` |
| 4 | frontend | `v5_frontend.md` | `status/frontend.json` |
| 5 | devops | `v5_devops.md` | `status/devops.json` |

## Muhim cheklovlar

- V4 (auto-reply, webhook, OAuth) regression TAQIQLANGAN.
- Hech bir sir kodda yo'q — hammasi `.env`.
- Statistika AI'siz ishlashi shart (graceful degradation).
- Frontend'da provider nomlari ko'rinmaydi.

## Migratsiya

```bash
cd backend && alembic upgrade head   # 008_v5_instagram_ai_analyst
```
