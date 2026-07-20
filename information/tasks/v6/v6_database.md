# V6 Database Agent — Facebook + AI posts jadvallari

> Spec: `v6-spec.md` §2. Tugagach `status/database.json` yangila.

## Kontekst (mavjud kod)
- Migratsiya head: **008** (`backend/alembic/versions/008_v5_instagram_ai_analyst.py`). Yangi: `009_v6_facebook_and_ai_posts.py`, `down_revision='008'`.
- `backend/app/models/account.py` — `accounts` modeli (`platform` String(50), `credentials`, `ig_user_id`, `ig_webhook_subscribed`). Buni KENGAYTIR (yangi nullable ustunlar), mavjud ustunlarga teginma.
- `backend/app/models/autoreply.py` — `AutoReplyRule`/`AutoReplyLog`, **String ustunlar (ENUM emas)**, `JSONBType = JSONB().with_variant(JSON(),"sqlite")` patterni mavjud. Idempotency `uq_autoreply_account_object`.
- `backend/app/models/__init__.py` — yangi modellarni export qil.
- V5 migratsiyada `server_default` uchun `sa.text("'[]'::jsonb")` (string literal EMAS) va modelda Python `default=list/dict` ishlatilgan — shu uslubni takrorla (SQLite testlar buzilmasin).

## Vazifalar
1. **accounts kengaytirish** (`account.py` + migratsiya `op.add_column`): `fb_user_id` VARCHAR(255) null, `fb_page_id` VARCHAR(255) null, `fb_page_name` VARCHAR(255) null, `fb_webhook_subscribed` Boolean default false server_default='false', `token_status` VARCHAR(16) default 'active' server_default='active'.
2. **autoreply_rules**: `platform` VARCHAR(16) server_default='instagram' not null; `reply_mode` VARCHAR(16) server_default='template' not null; `ai_context` TEXT null. **autoreply_logs**: `platform` VARCHAR(16) server_default='instagram' not null; `reply_mode` VARCHAR(16) null. Modellar (`autoreply.py`) + migratsiya `op.add_column`.
3. **Yangi model fayl** `backend/app/models/ai_posts.py` — `AiPostDraft` va `ImageJob` (spec §2.3, §2.4). JSONBType ishlatilsin. Status ustunlari String. FK: user_id→users CASCADE, account_id→accounts SET NULL, draft_id→ai_post_drafts SET NULL, image_job_id→image_jobs SET NULL.
   - **Circular FK** (drafts.image_job_id ↔ image_jobs.draft_id): modelda `use_alter=True, name="..."` bilan ForeignKey; migratsiyada ikkala jadvalni FK'siz yarat, keyin `op.create_foreign_key` bilan ikkalasini bog'la. Downgrade'da FK'larni avval drop.
4. **Migratsiya** `009_v6_facebook_and_ai_posts.py`: upgrade (add_column'lar → ikkita yangi jadval → circular FK'lar → indexlar: ai_post_drafts(user_id), image_jobs(user_id)); downgrade TO'LIQ teskari.
5. `models/__init__.py` export.

## Tekshiruv
- `cd backend && venv\Scripts\python.exe -c "from app.models import *; print('OK')"`.
- `venv\Scripts\python.exe -m py_compile alembic\versions\009_v6_facebook_and_ai_posts.py`.
- **MUHIM**: `venv\Scripts\python.exe -m alembic upgrade head` dev bazada xatosiz o'tsin (DATABASE_URL `.env` dan), keyin `alembic current` = 009. Agar `'[]'::jsonb` yoki enum double-create xatosi chiqsa V5 patterni bo'yicha tuzat.
- `venv\Scripts\python.exe -m pytest tests -q` — V4/V5 regression yo'q (83 test o'tishi kerak; SQLite `create_all` JSONBType bilan ishlashini ta'minla).

Status JSON: `status/database.json` (V5 format, "agent":"database").
