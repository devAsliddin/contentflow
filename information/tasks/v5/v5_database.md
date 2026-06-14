# V5 Database Agent — Instagram AI Analyst jadvallari

> Spec: `information/tasks/v5/v5-spec.md` §2. Ish tugagach `status/database.json` ni yangila.

## Kontekst (mavjud kod)

- Loyiha ildizi: `backend/` (FastAPI, SQLAlchemy 2.0 async, PostgreSQL 15, Alembic).
- Mavjud modellar: `backend/app/models/` — `account.py`, `user.py`, `post.py`, `autoreply.py`, `follower_snapshot.py`, `post_template.py`. Pattern: `Mapped[...]` + `mapped_column`, UUID PK `default=uuid.uuid4`, timezone-aware `DateTime(timezone=True)`.
- Modellar `backend/app/models/__init__.py` da export qilinadi — yangi modellarni qo'sh.
- Mavjud migratsiyalar: `backend/alembic/versions/001...007_v4_autoreply.py`. Yangi migratsiya `008_v5_instagram_ai_analyst.py` bo'lsin, `down_revision` = 007 ning revision id'si (faylni o'qib aniqlab ol).
- `accounts` jadvaliga TEGINMA (V4 regression taqiqlangan).

## Vazifalar

1. **Yangi model fayl(lar)i** — `backend/app/models/analysis.py` (bitta faylda hammasi) quyidagi 7 jadval, spec §2.1–2.7 dagi ustunlar bilan aynan:
   - `media_items` (index: `(account_id, posted_at DESC)`, `ig_media_id` UNIQUE)
   - `media_metrics` (index: `(media_item_id, fetched_at DESC)`)
   - `media_classifications` (`media_item_id` UNIQUE)
   - `account_metrics_snapshots` (UNIQUE `(account_id, snapshot_date)`)
   - `account_profiles` (`account_id` indexed, `version` INTEGER)
   - `ai_recommendations` (UNIQUE `(account_id, week_start)`)
   - `analysis_jobs`
2. **ENUM'lar** PostgreSQL native enum sifatida (sqlalchemy `Enum(..., name="...", create_type=...)`):
   - `media_type_enum`: IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
   - `profile_status_enum`: generating, ready, failed
   - `analysis_job_type_enum`: initial_analysis, weekly_refresh
   - `analysis_job_status_enum`: queued, fetching, computing, classifying, profiling, done, failed
3. **FK'lar**: barcha account FK'lar `ForeignKey("accounts.id", ondelete="CASCADE")`; media FK'lar `media_items.id` ga CASCADE.
4. **Alembic migratsiya** `008_v5_instagram_ai_analyst.py`:
   - `upgrade()`: enum'lar → jadvallar → indexlar.
   - `downgrade()`: TO'LIQ — jadvallar → enum'lar (`DROP TYPE`).
5. `backend/app/models/__init__.py` ga yangi modellarni qo'sh.
6. **Tekshiruv**: `cd backend && python -c "from app.models import *"` xatosiz o'tsin; migratsiya fayli sintaktik to'g'ri (`python -m py_compile`).

## Status JSON formati (`information/tasks/v5/status/database.json`)

```json
{ "agent": "database", "version": "v5", "status": "in_progress|done|blocked", "tasks_done": [], "blockers": [], "updated_at": "ISO8601" }
```
