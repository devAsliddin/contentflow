# V5 Backend Agent — AI layer, insights fetch, stats, API

> Spec: `information/tasks/v5/v5-spec.md` §3. Database agent ishi tugagan bo'lishi shart (modellar `app/models/analysis.py`). Ish tugagach `status/backend.json` ni yangila.

## Kontekst (mavjud kod)

- `backend/app/config.py` — pydantic-settings `Settings`. Yangi env o'zgaruvchilarni shu yerga qo'sh (spec §3.1): `ai_analysis_provider`, `ai_classification_provider`, `ai_content_provider`, `ai_fallback_chain`, `groq_api_key`, `groq_model`, `groq_max_retries`, `vllm_base_url`, `vllm_model`, `openrouter_api_key` (BOR), `openrouter_model` (BOR — default'ini o'zgartirma), `anthropic_api_key` (BOR), `anthropic_analysis_model`, `analysis_media_limit`, `analysis_classify_chunk_size`.
- `.env.example` ga ham qo'sh (root: `contentflow/.env.example`).
- Fernet decrypt: `app/services/encryption.py` (`decrypt_credentials`). V4 token o'qish patterni: `app/tasks/instagram_autoreply.py` va `app/services/instagram_graph.py` ga qara.
- Graph API patterni: `app/services/instagram_graph.py` (httpx, `settings.instagram_graph_version`).
- Auth/ownership patterni: `app/routers/autoreply.py` yoki `app/routers/accounts.py` — `get_current_user` + account user_id tekshiruvi.
- OAuth: `app/routers/instagram_connect.py` — `SCOPE` konstantasi va `instagram_oauth_callback`.
- Redis: `app/redis_client.py`.
- Router ro'yxatga olish: `app/main.py`.

## Vazifalar

### 1. AI Provider abstraction — `app/services/ai/` (spec §3.2)

Fayllar: `__init__.py`, `base.py`, `groq_provider.py`, `vllm_provider.py`, `openrouter_provider.py`, `anthropic_provider.py` (stub — to'liq interfeys, `httpx` bilan Anthropic Messages API chaqiruvi yozilgan, lekin router unga route qilmaydi), `router.py`, `json_utils.py`.

- `base.py`: `AIProvider(ABC)` + `AICompletion` dataclass (spec'dagi imzo aynan).
- Groq/OpenRouter/vLLM — umumiy OpenAI-compatible bazaviy klass (`_OpenAICompatProvider`), faqat base_url/api_key/model farqi. Groq base_url: `https://api.groq.com/openai/v1`.
- 429: `Retry-After` header hurmat qilinadi, bo'lmasa exponential backoff 2,4,8,16,32 s (max `groq_max_retries`). `asyncio.sleep` ishlat.
- `router.py`: `async def complete_for_task(task_type: Literal["analysis","classification","content"], *, system, prompt, ...) -> AICompletion` — config'dan provider tanlaydi; xato bo'lsa `ai_fallback_chain` bo'yicha keyingisi, WARNING log. API key bo'lmagan provider chain'dan skip qilinadi.
- `json_utils.py`: `extract_json(text)` (```json fence strip, birinchi `{`/`[` dan parse), `complete_json_validated(task_type, system, prompt, schema: type[BaseModel])` — validatsiya yiqilsa 1 marta correction-retry, keyin keyingi provider'ga fallback.
- Har AI chaqiruv: INFO log (provider, model, in/out tokens, latency ms).

### 2. Instagram insights fetch — `app/services/instagram_insights.py` (spec §3.3)

- `fetch_media_list(token, limit)` — pagination bilan.
- `fetch_media_insights(token, media_id, media_type)` — REELS uchun qo'shimcha metrikalar. 403/insights yo'q → `None` qaytar (graceful).
- `fetch_account_insights(token, ig_user_id)` — reach/impressions/profile_views days_28 + demographics; 403 → None.
- `me/media` fields'ga `like_count,comments_count` ham qo'sh — insights yo'q bo'lganda public fallback.
- Xato siyosati: 401 → maxsus `TokenExpiredError`; 429 → backoff; boshqa → 3 retry, keyin exception.
- **Scope**: `instagram_connect.py` dagi `SCOPE` ga `instagram_business_manage_insights` qo'sh (yangi ulanishlar uchun). Mavjud tokenlarda insights 403 bo'lsa graceful degradation ishlaydi.

### 3. Statistik tahlil — `app/services/analysis/stats.py` (spec §3.4, AI YO'Q)

- `app/services/analysis/__init__.py` yarat.
- `async def compute_stats(db, account_id) -> StatsSummary` — DB'dagi `media_items` + eng so'nggi `media_metrics` + `account_metrics_snapshots` dan hisoblaydi.
- Pydantic modellar: `StatsSummary`, `HourScore (weekday, hour, avg_er, posts)`, `FormatScore`, `HashtagScore`, `TopPost`, `DateValue` — `app/schemas/analysis.py` da.
- ER formula: `(likes+comments+saves+shares)/reach`, reach yo'q → followers'ga nisbatan; `er_basis: "reach"|"followers"` fieldi bilan.
- Hashtag parse: caption'dan `#\w+` regex (DB'da `hashtags` JSONB allaqachon bor — fetch paytida to'ldiriladi).

### 4. API endpointlar — `app/routers/analysis.py` (spec §3.5)

6 endpoint, hammasi `get_current_user` + ownership. `app/main.py` ga `prefix="/api/accounts"` bilan ulanadi (mavjud router pattern).

- `POST /{id}/analysis/start` — aktiv (`queued..profiling`) job bo'lsa 409; `analysis_jobs` ga queued yozadi, Celery task `run_initial_analysis.delay(...)` (import: `app.tasks.analysis_tasks`), job_id qaytaradi.
- `GET /{id}/analysis/status` — oxirgi job.
- `GET /{id}/analysis/stats` — `compute_stats` chaqiradi (media yo'q bo'lsa 404 "tahlil hali yo'q").
- `GET /{id}/analysis/profile` — eng so'nggi `status='ready'` profil, yo'q → 404.
- `GET /{id}/analysis/recommendations` — eng so'nggi.
- `POST /{id}/analysis/content-ideas` — body `{count: int (1-5), topic_hint?: str}`; profil+stats kontekst bilan sinxron `complete_for_task("content", ...)`; Redis rate limit `content_ideas:{user_id}` soatiga 10 (429 qaytar). Javob: `{ideas: [{title, caption_draft, format, hashtags[]}]}` (Pydantic validatsiya).

### 5. Avtomatik trigger

`instagram_oauth_callback` muvaffaqiyatida (`account` saqlangach, redirect'dan OLDIN): `analysis_jobs` ga queued job + `run_initial_analysis.delay(str(account.id))` — try/except bilan o'ralgan (fail bo'lsa faqat log, callback yiqilmasin).

Eslatma: Celery task'larning o'zi Celery agent tomonidan yoziladi (`app/tasks/analysis_tasks.py`). Sen routerda faqat `.delay()` chaqiruvini yoz — agar import paytida modul hali bo'lmasa, lazy import ishlat (`from app.tasks.analysis_tasks import run_initial_analysis` funksiya ichida).

### 6. Tekshiruv

- `python -c "from app.main import app"` xatosiz.
- Hech qanday API key/sir kodda hardcode emas.
- V4 fayllariga minimal teginish: faqat `SCOPE` + callback trigger.

## Status JSON: `information/tasks/v5/status/backend.json` (database.json formati kabi, "agent": "backend").
