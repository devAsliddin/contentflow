# 04 — Backend: Rules CRUD + logs

**Agent:** backend · **Status:** done

## Endpointlar (`app/routers/autoreply.py`, prefix `/api`)
Barchasi `get_current_user` bilan himoyalangan va **egalik tekshiruvi** bor
(`_owned_account`, `_owned_rule` — `user_id` mosligi).

- `GET  /accounts/{account_id}/autoreply-rules` — ro'yxat (priority DESC, created DESC).
- `POST /accounts/{account_id}/autoreply-rules` — yaratish.
- `PATCH /autoreply-rules/{rule_id}` — qisman tahrirlash (`exclude_unset`).
- `DELETE /autoreply-rules/{rule_id}` — o'chirish.
- `GET  /accounts/{account_id}/autoreply-logs?limit=50` — loglar (max 200).

## Validatsiya (`app/schemas/autoreply.py`)
- `match_type != 'any'` bo'lsa `keywords` bo'sh bo'lmasligi shart.
- `comment_action` faqat `target='comment'` uchun; `dm` da `null`'ga majburlanadi,
  `comment` da default `reply_public`.
- `reply_text` 1–1000 belgi. PATCH'da merge qilingan holatda invariantlar qayta tekshiriladi.

## Schema fields
`AccountOut` ga `ig_user_id` va `ig_webhook_subscribed` qo'shildi — frontend qaysi
Instagram akkaunt auto-reply uchun ulanganini aniqlashi uchun.
