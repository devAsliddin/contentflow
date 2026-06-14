# V6 Celery Agent — images queue, FB comment reply, AI reply branch, beat

> Spec: `v6-spec.md` §4. Database+Backend tugagan (`app/models/ai_posts.py`, `app/services/images/router.py`, `app/services/facebook_graph.py`, `app/services/ai/router.py`). Tugagach `status/celery.json` yangila.

## Kontekst (mavjud kod — o'rgan)
- `app/tasks/celery_app.py` — Celery app, `include`, `beat_schedule`, V5 `task_routes`/queue patterni (`analysis` queue). V4/V5 yozuvlarga TEGINMA, faqat qo'sh.
- `app/tasks/instagram_autoreply.py` — `process_instagram_event`, `_handle_entry`, `_handle_match`, `_matches`, `_claim_object`, `_finalize`, `_log`, `_rate_ok`. FB task shu arxitekturani qayta ishlatadi. **`_handle_match` ga `reply_mode='ai'` branch** qo'shiladi.
- `app/tasks/analysis_tasks.py` — V5 async-in-Celery + queue patterni namunasi.
- `app/services/ai/router.py` `complete_for_task("content", ...)`, `json_utils.complete_json_validated`.
- `app/services/images/router.py` `generate_image(prompt,width,height,seed)`, `storage.py`.
- `app/services/facebook_graph.py` `reply_to_comment`, `check_token`.
- `app/models/autoreply.py` — `platform`, `reply_mode`, `ai_context` ustunlari (DB agent qo'shgan). `app/models/account.py` — `fb_page_id`, `token_status`.

## Vazifalar
1. **`app/tasks/image_tasks.py`**: `generate_image_task(image_job_id)` `queue="images"`. image_jobs→generating → `generate_image(prompt,w,h,seed)` → `storage` saqlash → done (file_path, width, height, finished_at, provider/model `generation_meta`/ustunlar). Xatoda failed+error_message. Async-in-Celery patterni (`asyncio.run`).
2. **`app/tasks/facebook_autoreply.py`**: `process_facebook_event(payload)` `default` queue. `entry[].changes[]` field=='feed', value.item=='comment', verb=='add'. page_id (entry.id) → account(platform='facebook', fb_page_id==page_id, is_active). comment_id=value.comment_id, from_id=value.from.id, text=value.message. Loop himoya (from_id==account.fb_page_id → skipped_self). `_claim_object` (event_type='comment', platform='facebook', reply_mode log). Rule match (platform='facebook', target='comment'). Rate limit Page'ga soatiga 100 (`fb_reply_count:{account_id}:{bucket}`). Reply: template→`facebook_graph.reply_to_comment(token, comment_id, text)`; ai→`_ai_reply(...)`. autoreply_logs to'liq (platform, reply_mode).
   - Idempotency: mavjud `uq_autoreply_account_object` (account_id, comment_id). V4 `_claim_object`/`_finalize` ni umumiy qilib qayta ishlatsang bo'ladi (yoki nusxa). `_log`/`_finalize` ga `platform`/`reply_mode` qiymatlarini yoz.
3. **AI reply (umumiy helper)** — `app/tasks/ai_reply.py` (yoki facebook_autoreply ichida, IG ham import qiladi): `async def generate_ai_reply(account, rule, comment_text, post_context) -> str|None`. Profil ton (`account_profiles` so'nggi ready, bo'lmasa neytral) + rule.ai_context + komment → `complete_json_validated("content", schema={reply,skip})`. ≤300 belgi (kesib tashla). Guardrail system promptda: faqat biznes mavzu, narx/va'da o'ylama, spam/haqorat→skip:true. skip→None.
4. **IG `reply_mode='ai'` branch**: `instagram_autoreply.py` `_handle_match` da matched_rule topilgach — `matched_rule.reply_mode=='ai'` bo'lsa `generate_ai_reply(...)` chaqir; None→`skipped_ai` status; aks holda shu matn bilan `ig.reply_to_comment`/`send_dm` (dm uchun ham). Template branch o'zgarmaydi. **Minimal o'zgarish — regression testlar o'tishi shart.**
5. **celery_app.py**: `include` ga `app.tasks.image_tasks`, `app.tasks.facebook_autoreply` (va ai_reply bo'lsa). `task_routes`/queue: image task 'images'. Beat: `fb_token_health_check` (kunlik 03:45 — V5 03:30 snapshot bilan to'qnashmasin; FB akkauntlar `check_token`→190→token_status='expired') va `cleanup_old_image_jobs` (kunlik 04:30 — 30 kundan eski discarded draft image fayllari diskdan + image_jobs tozalash). Mavjud beat yozuvlarga teginma.

## Cheklovlar
- V4 IG auto-reply va V5 analysis regression yo'q. Token log qilinmaydi.
- Worker endi `-Q default,analysis,images` (DevOps unit'da).

## Tekshiruv
- `venv\Scripts\python.exe -c "from app.tasks.celery_app import celery_app; print(sorted(celery_app.tasks.keys()))"` — yangi tasklar ro'yxatda.
- `venv\Scripts\python.exe -c "from app.main import app; print('OK')"`.
- `venv\Scripts\python.exe -m pytest tests -q` — regression (V4 autoreply testlari o'tsin).

Status JSON: `status/celery.json`.
