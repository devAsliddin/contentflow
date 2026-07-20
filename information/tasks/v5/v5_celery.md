# V5 Celery Agent — tahlil task chain + beat

> Spec: `information/tasks/v5/v5-spec.md` §4. Database + Backend agentlar ishi tugagan (modellar, `app/services/ai/`, `app/services/instagram_insights.py`, `app/services/analysis/stats.py` mavjud). Ish tugagach `status/celery.json` ni yangila.

## Kontekst (mavjud kod)

- `backend/app/tasks/celery_app.py` — Celery app, `include` ro'yxati, `beat_schedule`. V4 jadvallariga (refresh-instagram-tokens, recover-missed-posts, weekly-analytics-summary) TEGINMA — faqat qo'sh.
- Mavjud task pattern: `app/tasks/instagram_autoreply.py` — async DB session ochish (`asyncio.run` + `AsyncSessionLocal`), Redis lock, retry pattern shu yerdan olinadi.
- AI router: `app.services.ai.router.complete_for_task`, JSON validatsiya: `app.services.ai.json_utils`.
- Pydantic schemalar: `app/schemas/analysis.py` (StatsSummary). Profile va Recommendations schemalarini ham shu faylga qo'sh (spec §4.4, §4.5) agar backend qo'shmagan bo'lsa.

## Vazifalar — `app/tasks/analysis_tasks.py`

### 1. Lock + holat boshqaruvi

- Redis lock `analysis_lock:{account_id}`, TTL 30 min (`SET NX EX`). Lock olinmasa task chiqib ketadi (log INFO).
- Har bosqichda `analysis_jobs` yangilanadi: fetching=20, computing=40, classifying=60, profiling=80, done=100. Xato → status=failed + error_message, lock release (finally).
- Barcha tasklar **idempotent**: media upsert (`ig_media_id` bo'yicha), profil yangi versiya, recommendations upsert (`week_start`).
- Barcha tasklar `queue="analysis"` bilan (`@celery_app.task(name="contentflow.fetch_media_and_metrics", queue="analysis")` yoki task_routes).

### 2. Task chain: `run_initial_analysis(account_id, job_id=None)`

Bitta orkestr task (oddiyroq va lock bilan mos) ichida ketma-ket bosqichlar — yoki Celery `chain`; qaysi biri tanlansa ham progress yangilanishi shart:

1. **fetch_media_and_metrics**: token decrypt (V4 pattern) → `instagram_insights` orqali media list (`ANALYSIS_MEDIA_LIMIT`) → `media_items` upsert (hashtags parse `#\w+`) → har media insights → `media_metrics` insert (ER hisoblab) → account insights → bugungi `account_metrics_snapshots` upsert. Insights 403 → public metrikalar bilan davom, `error_message` ga izoh, YIQILMA. 401 → job failed "token expired, reconnect".
2. **compute_stats**: `compute_stats()` chaqir — natija keshlash shart emas (endpoint o'zi hisoblaydi), faqat progress 40%.
3. **classify_captions**: klassifikatsiyasi yo'q media'lar, `ANALYSIS_CLASSIFY_CHUNK_SIZE` (10) tadan chunk. Provider: `complete_for_task("classification", ...)` — spec §4.2 prompt. Javob JSON array validatsiya (Pydantic `CaptionClassification`); yiqilsa router avtomatik fallback (Groq). Natija → `media_classifications` upsert. Caption'siz media skip.
4. **generate_account_profile**: kontekst spec §4.3 (StatsSummary JSON + klassifikatsiya agregatsiyasi + top 10/worst 3 captionlar + username/followers). `account_profiles` ga `status=generating` yangi versiya (max(version)+1) → `complete_for_task("analysis", ...)` + `AccountProfileSchema` validatsiya → `ready` yoki `failed`.
5. **generate_recommendations**: aktiv profil + StatsSummary → spec §4.5 JSON → `ai_recommendations` upsert (joriy hafta dushanbasi `week_start`).

LLM byudjeti: bitta akkaunt ≈ 8-10 chaqiruv maksimum (50 post / 10 chunk = 5 + profil + tavsiya = 7).

### 3. Doimiy 429 (Groq kuni tugadi)

Barcha providerlar 429/xato bersa: job status → `queued`, `self.retry(countdown=6*3600, max_retries=4)`.

### 4. Beat tasklari (spec §4.6)

`app/tasks/analysis_tasks.py` da:
- `daily_account_snapshot` — har kuni 03:30 UTC (V4 token refresh 03:00 da — to'qnashmasin): barcha aktiv IG akkauntlar uchun account insights → snapshot upsert. Xato bir akkauntda bo'lsa qolganlari davom etadi.
- `weekly_refresh` — dushanba 04:00 UTC: har IG akkaunt uchun `run_initial_analysis` ni `job_type='weekly_refresh'` bilan enqueue, akkauntlar orasida `countdown` 60 s stagger.

`celery_app.py` ga: `include` ga `app.tasks.analysis_tasks` qo'sh, `beat_schedule` ga 2 yangi yozuv qo'sh, `task_routes = {"contentflow.run_initial_analysis": {"queue": "analysis"}, ...}` (yoki task dekoratorida queue) — mavjud konfigni buzmasdan.

### 5. Tekshiruv

- `python -c "from app.tasks.celery_app import celery_app; print(sorted(celery_app.tasks.keys()))"` — yangi tasklar ro'yxatda.
- V4 `instagram_autoreply` tasklari o'zgarmagan.

## Status JSON: `information/tasks/v5/status/celery.json`.
