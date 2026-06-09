# 05 — Celery: auto-reply logikasi

**Agent:** backend · **Status:** done · **Fayl:** `app/tasks/instagram_autoreply.py`

## `process_instagram_event(payload)`
- `payload.object != "instagram"` → e'tiborsiz.
- Har `entry` uchun `entry["id"]` (recipient IG id) bo'yicha `accounts.ig_user_id`
  topiladi. Topilmasa log + skip.
- **DM** (`entry["messaging"]`):
  - `message.is_echo` → skip (o'z xabarimiz aks-sadosi).
  - `sender_id == account.ig_user_id` → `skipped_self` (LOOP HIMOYASI).
  - timestamp 24 soatdan eski → `skipped_24h`.
  - aks holda `_handle_match(target='dm', mid)`.
- **Comment** (`entry["changes"]`, `field=='comments'`):
  - `value.from.id == account.ig_user_id` → `skipped_self`.
  - aks holda `_handle_match(target='comment', value.id)`.

## `_handle_match`
1. **Idempotensiya** — `_claim_object`: `INSERT ... ON CONFLICT (uq_autoreply_account_object)
   DO NOTHING RETURNING id`. Bo'sh qaytsa = allaqachon ishlangan → return.
2. Faol qoidalar (target bo'yicha, priority DESC) yuklanadi, birinchi mos qoida:
   `any` | `contains` | `exact` | `starts_with`, `case_sensitive` hisobga olinadi.
   Mos yo'q → `skipped_no_match`.
3. **Rate limit (faqat DM)** — Redis `ig_dm_count:{account}:{YYYYMMDDHH}` INCR + EXPIRE 3600,
   `> 200` → `skipped_rate_limit`.
4. Token Fernet bilan decrypt → Graph API javob:
   - DM → `send_dm`.
   - Comment → `comment_action`: `reply_public` (`/{comment_id}/replies`),
     `reply_private` (`me/messages` + `recipient.comment_id`), `both` = ikkalasi.
5. `autoreply_logs`: `sent` yoki `failed (+error_detail)`. Retry **faqat** 5xx/network
   xatolarida (max 2); 4xx (ruxsat/24h/invalid) da retry yo'q.

## Kafolatlar
Loop himoyasi · idempotensiya (UNIQUE) · DM 200/soat · 24-soat qoidasi — barchasi
log'ga yoziladi. Celery `include` + beat schedule `celery_app.py` da.
