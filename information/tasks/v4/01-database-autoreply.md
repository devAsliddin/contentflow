# 01 — Database: auto-reply jadvallari

**Agent:** database · **Status:** done

## Bajarilgan
Alembic migratsiya `007_v4_autoreply` (down_revision `006`).

### Yangi jadvallar
- **`autoreply_rules`** — kalit so'z qoidalari. Ustunlar spec §2.1 bo'yicha.
  Indekslar: `(account_id, target, is_active)`, `(user_id)`.
- **`autoreply_logs`** — har bir hodisa uchun audit/idempotensiya. Ustunlar spec §2.2.
  Indekslar: `(account_id, created_at)`, `(status)`, **UNIQUE `(account_id, ig_object_id)`**.

### `accounts` jadvaliga qo'shildi
- `ig_user_id VARCHAR(255)` (nullable, indexed) — loop himoyasi + webhook routing.
- `ig_webhook_subscribed BOOLEAN default false`.

## Dizayn qarori — ENUM o'rniga VARCHAR + CHECK
Spec native PG ENUM so'ragan edi; o'rniga `VARCHAR + CHECK constraint` ishlatildi.
Sabab: ORM modellari bu ustunlarni `String` deb map qiladi, va CHECK bir xil
qiymat-xavfsizligini beradi — lekin kelajakda yangi qiymat qo'shishda `ALTER TYPE
... ADD VALUE` muammosi bo'lmaydi. `downgrade()` to'liq yozilgan.

## Fayllar
- `backend/alembic/versions/007_v4_autoreply.py`
- `backend/app/models/autoreply.py`
- `backend/app/models/account.py` (ustunlar)
- `backend/app/models/__init__.py` (registratsiya)

## Migratsiya
```bash
cd backend && alembic upgrade head
```
