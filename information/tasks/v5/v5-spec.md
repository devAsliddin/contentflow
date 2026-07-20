# V5 SPEC: Instagram AI SMM Tahlilchi (to'liq texnik topshiriq)

> Multi-agent tizim (Team Lead, Database, Backend, Celery, Frontend, DevOps) shu fayl asosida ishlaydi.
> Agent task fayllari shu papkada (`v5_<agent>.md`), status JSON'lar `status/` da.

---

## 0. UMUMIY MAQSAD

User Instagram akkauntini OAuth orqali ulaganidan keyin tizim **avtomatik ravishda** akkauntni tahlil qiladi va shu userga moslashgan "AI SMM manager" funksiyasini taqdim etadi:

1. **Statistik tahlil** (AI'siz, Python/SQL): eng yaxshi post vaqtlari, format performance (reel/carousel/photo), hashtag samaradorligi, engagement trend, follower o'sishi.
2. **Account Profile** (AI bilan): akkauntning "DNK"si — niche, tone of voice, kontent ustunlari (content pillars), auditoriya portreti. Bir marta generatsiya qilinadi, JSON sifatida keshlanadi, haftada bir yangilanadi.
3. **Haftalik tavsiyalar** (AI bilan): statistika + profil asosida personalized strategiya.
4. **Kontent g'oyalari generatori** (AI bilan): user tugma bosganda uning tonida, uning nichesiga mos post g'oyalari.

### Kritik arxitektura printsipi: FREE-FIRST AI

Boshlang'ich bosqichda **hech qanday pullik AI ishlatilmaydi**. AI qatlami provider-agnostic abstraction orqali quriladi:

| Vazifa | Provider (hozir) | Kelajakda (config almashtirish bilan) |
|---|---|---|
| Account Profile, tavsiyalar | **Groq** (llama-3.3-70b-versatile, free tier) | Claude Sonnet |
| Caption klassifikatsiya | **vLLM** (Qwen2.5-7B-Instruct, o'z VPS) | Claude Haiku |
| Kontent g'oyalari | **Groq** | Groq (o'zgarmaydi) |
| Fallback zanjiri | Groq → OpenRouter (free) → vLLM | — |

Provider almashtirish **faqat `.env` o'zgarishi** bilan bo'lishi shart — kod o'zgarmaydi.

### Og'ir ish AI'ga yuklanmaydi

Barcha raqamli hisob-kitoblar (vaqt tahlili, engagement rate, trend) Python'da bajariladi. LLM'ga faqat **siqilgan, tayyor agregatsiya + caption matnlari** boradi. Bu free tier rate limitlariga sig'ish va sifat uchun majburiy talab.

---

## 2. DATABASE — PostgreSQL 15 + Alembic

Yangi Alembic migratsiya (`v5_instagram_ai_analyst`). Barcha jadvallar SQLAlchemy 2.0 async modellari bilan.

### 2.1 `media_items` — Instagram postlar keshi
| Ustun | Tur | Izoh |
|---|---|---|
| id | UUID PK | |
| account_id | FK → accounts.id, ON DELETE CASCADE | |
| ig_media_id | VARCHAR(255), UNIQUE | Instagram media ID |
| media_type | ENUM('IMAGE','VIDEO','CAROUSEL_ALBUM','REELS') | |
| caption | TEXT nullable | |
| hashtags | JSONB default '[]' | Caption'dan parse qilingan |
| permalink | TEXT nullable | |
| posted_at | TIMESTAMPTZ | Instagram timestamp |
| created_at / updated_at | TIMESTAMPTZ | |

Index: `(account_id, posted_at DESC)`.

### 2.2 `media_metrics` — post statistikasi (snapshot)
| Ustun | Tur |
|---|---|
| id | UUID PK |
| media_item_id | FK → media_items.id, ON DELETE CASCADE |
| like_count, comments_count, saved_count, shares_count, reach, impressions, plays | INTEGER nullable |
| avg_watch_time_ms | INTEGER nullable (faqat reels) |
| engagement_rate | NUMERIC(6,4) nullable — backend hisoblaydi |
| fetched_at | TIMESTAMPTZ |

Index: `(media_item_id, fetched_at DESC)`.

### 2.3 `media_classifications` — AI klassifikatsiya natijasi
| Ustun | Tur |
|---|---|
| id | UUID PK |
| media_item_id | FK, UNIQUE (1 post = 1 klassifikatsiya) |
| topic | VARCHAR(100) |
| tone | VARCHAR(50) |
| has_cta | BOOLEAN |
| language | VARCHAR(10) |
| model_used | VARCHAR(100) |
| created_at | TIMESTAMPTZ |

### 2.4 `account_metrics_snapshots` — akkaunt darajasidagi kunlik snapshot
| Ustun | Tur |
|---|---|
| id | UUID PK |
| account_id | FK → accounts.id, CASCADE |
| snapshot_date | DATE, UNIQUE birga `(account_id, snapshot_date)` |
| followers_count, following_count, media_count | INTEGER |
| reach_28d, impressions_28d, profile_views_28d | INTEGER nullable |
| demographics | JSONB nullable — yosh/jins/shahar |
| raw | JSONB — API javobi to'liq |

### 2.5 `account_profiles` — AI tomonidan yaratilgan "Akkaunt DNK"si
| Ustun | Tur |
|---|---|
| id | UUID PK |
| account_id | FK, indexed |
| version | INTEGER — har yangilanishda +1, eski versiyalar saqlanadi |
| profile_json | JSONB — 4.4 schema |
| model_used | VARCHAR(100) |
| status | ENUM('generating','ready','failed') |
| error_message | TEXT nullable |
| created_at | TIMESTAMPTZ |

Eng so'nggi `ready` versiya = aktiv profil.

### 2.6 `ai_recommendations` — haftalik tavsiyalar
| Ustun | Tur |
|---|---|
| id | UUID PK |
| account_id | FK |
| week_start | DATE, UNIQUE birga `(account_id, week_start)` |
| recommendations_json | JSONB |
| model_used | VARCHAR(100) |
| created_at | TIMESTAMPTZ |

### 2.7 `analysis_jobs` — tahlil jarayoni holati (frontend polling uchun)
| Ustun | Tur |
|---|---|
| id | UUID PK |
| account_id | FK |
| job_type | ENUM('initial_analysis','weekly_refresh') |
| status | ENUM('queued','fetching','computing','classifying','profiling','done','failed') |
| progress_pct | SMALLINT default 0 |
| error_message | TEXT nullable |
| started_at / finished_at | TIMESTAMPTZ nullable |

ENUM'lar PostgreSQL native enum sifatida. Downgrade funksiyalari to'liq yozilsin.

---

## 3. BACKEND — FastAPI

V2/V4 patternlariga amal qil: SQLAlchemy 2.0 async, Fernet token decrypt, parameterized queries, hech qanday sir kodga yozilmaydi — hammasi `.env` dan.

### 3.1 `.env` yangi o'zgaruvchilar
```
# AI Provider routing (free-first)
AI_ANALYSIS_PROVIDER=groq          # profil + tavsiyalar
AI_CLASSIFICATION_PROVIDER=vllm    # caption klassifikatsiya
AI_CONTENT_PROVIDER=groq           # kontent g'oyalari
AI_FALLBACK_CHAIN=groq,openrouter,vllm

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_MAX_RETRIES=5

VLLM_BASE_URL=http://127.0.0.1:8000/v1
VLLM_MODEL=Qwen2.5-7B-Instruct

OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Kelajak uchun tayyor (hozir ishlatilmaydi)
ANTHROPIC_API_KEY=
ANTHROPIC_ANALYSIS_MODEL=claude-sonnet-4-20250514

# Tahlil sozlamalari
ANALYSIS_MEDIA_LIMIT=50            # nechta oxirgi post tahlil qilinadi
ANALYSIS_CLASSIFY_CHUNK_SIZE=10    # bir LLM so'rovida nechta caption
```

### 3.2 AI Provider abstraction layer — `app/services/ai/`

```
app/services/ai/
├── base.py          # AIProvider(ABC)
├── groq_provider.py
├── vllm_provider.py
├── openrouter_provider.py
├── anthropic_provider.py   # stub, interfeys to'liq, hozir route qilinmaydi
├── router.py        # task_type → provider mapping + fallback chain
└── json_utils.py    # LLM javobidan JSON ajratish/validatsiya
```

**`base.py`:**
```python
class AIProvider(ABC):
    name: str
    @abstractmethod
    async def complete(
        self, *, system: str, prompt: str,
        max_tokens: int = 2000, temperature: float = 0.3,
    ) -> AICompletion: ...

@dataclass
class AICompletion:
    text: str
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
```

**Majburiy talablar:**
- Groq, OpenRouter, vLLM — uchchalasi ham OpenAI-compatible `/chat/completions`. Umumiy HTTP client (`httpx.AsyncClient`) bilan yoz, faqat base_url/api_key/model farq qiladi.
- **Rate limit handling**: 429 javobida `Retry-After` header'ni hurmat qil, bo'lmasa exponential backoff (2, 4, 8, 16, 32 s, max `GROQ_MAX_RETRIES`). Celery task ichida ishlaydi, bloklash muammo emas.
- **Fallback chain**: `router.py` da `AI_FALLBACK_CHAIN` bo'yicha — provider barcha retry'lardan keyin ham xato bersa, keyingisiga o'tiladi. Har bir fallback hodisasi WARNING log.
- **JSON-only output**: tahlil promptlari faqat JSON qaytarishni talab qiladi. `json_utils.py` da: ```json fence'larni olib tashlash, `json.loads`, Pydantic schema validatsiya. Validatsiya yiqilsa — 1 marta "sen noto'g'ri JSON qaytarding, faqat to'g'ri JSON qaytar" deb retry, keyin fallback.
- AI chaqiruvlar logi: provider, model, token count, latency — INFO darajada.

### 3.3 Instagram data fetch service — `app/services/instagram_insights.py`

`accounts` jadvalidan Fernet bilan decrypt qilingan long-lived token ishlatiladi (V4 patterni).

- **Media list**: `GET https://graph.instagram.com/{INSTAGRAM_GRAPH_VERSION}/me/media?fields=id,caption,media_type,media_product_type,permalink,timestamp&limit=25` — pagination (`paging.next`) bilan `ANALYSIS_MEDIA_LIMIT` tagacha.
- **Media insights**: `GET /{media_id}/insights?metric=reach,impressions,likes,comments,saved,shares` (REELS uchun qo'shimcha: `plays,ig_reels_avg_watch_time`).
- **Account insights**: `GET /{ig_user_id}/insights?metric=reach,impressions,profile_views&period=days_28` va follower demografiyasi.
- **MUHIM — scope tekshiruvi**: V4 scope'lari `instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments`. Insights uchun `instagram_business_manage_insights` talab qilinishi mumkin — kerak bo'lsa OAuth start scope ro'yxatiga qo'sh va frontend'da "qayta ulash kerak" (Reconnect patterni). Insights 403 qaytarsa — graceful degradation: faqat public metrikalar (like/comment count `me/media` fields orqali) bilan davom et, `analysis_jobs.error_message` ga izoh yoz, lekin tahlilni YIQITMA.
- Har bir API xatosi uchun: 401 → token expired flag (V4 reconnect oqimi), 429 → backoff, boshqa → log + retry 3 marta.

### 3.4 Statistik tahlil moduli — `app/services/analysis/stats.py` (AI YO'Q)

Sof Python/SQL. Kirish: account_id. Chiqish: `StatsSummary` (Pydantic):

```python
class StatsSummary(BaseModel):
    period_days: int
    total_posts: int
    avg_engagement_rate: float
    best_posting_hours: list[HourScore]      # haftaning kuni × soat bo'yicha engagement
    format_performance: list[FormatScore]    # REELS vs CAROUSEL vs IMAGE
    top_hashtags: list[HashtagScore]         # eng yaxshi 10 hashtag
    top_posts: list[TopPost]                 # eng yaxshi 5 post (id, permalink, ER)
    worst_posts: list[TopPost]               # eng yomon 3 post
    follower_trend: list[DateValue]          # snapshot'lardan
    posting_frequency_per_week: float
```

Engagement rate = `(likes + comments + saves + shares) / reach` (reach yo'q bo'lsa followers'ga nisbatan, qaysi formula ishlatilgani fieldda belgilansin).

### 3.5 API endpointlar (hammasi auth + account ownership tekshiradi)

| Method | Path | Vazifa |
|---|---|---|
| POST | `/api/accounts/{id}/analysis/start` | Qo'lda boshlash. Aktiv job bo'lsa 409. Celery chain'ni ishga tushiradi, job_id qaytaradi |
| GET | `/api/accounts/{id}/analysis/status` | Oxirgi job holati: status, progress_pct, error |
| GET | `/api/accounts/{id}/analysis/stats` | StatsSummary (keshdan, AI'siz) |
| GET | `/api/accounts/{id}/analysis/profile` | Aktiv account_profile JSON. Yo'q bo'lsa 404 |
| GET | `/api/accounts/{id}/analysis/recommendations` | Eng so'nggi haftalik tavsiyalar |
| POST | `/api/accounts/{id}/analysis/content-ideas` | Body: `{count: 1-5, topic_hint?: str}`. Sinxron Groq chaqiruv, 5-10 s. Rate limit: Redis, user'ga soatiga 10 ta |

**Avtomatik trigger**: V4 Instagram OAuth callback muvaffaqiyatli tugagach, `initial_analysis` Celery chain avtomatik enqueue (callback javobini KECHIKTIRMASDAN — fire-and-forget).

---

## 4. CELERY

Barcha tasklar idempotent. Har bir account uchun Redis lock (`analysis_lock:{account_id}`, TTL 30 min).

### 4.1 Task chain: `run_initial_analysis(account_id)`

```
fetch_media_and_metrics → compute_stats → classify_captions (vLLM, chunked)
  → generate_account_profile (Groq) → generate_recommendations (Groq)
```

Har bosqichda `analysis_jobs.status` va `progress_pct` (fetching=20%, computing=40%, classifying=60%, profiling=80%, done=100%).

### 4.2 `classify_captions` — vLLM chunked klassifikatsiya

- `ANALYSIS_CLASSIFY_CHUNK_SIZE` (10) tadan caption bitta promptda.
- System prompt (taxminiy):

```
Sen Instagram caption klassifikatorisan. Har bir caption uchun JSON qaytar.
Faqat JSON array qaytar, boshqa hech narsa yozma. Format:
[{"index": 0, "topic": "...", "tone": "professional|friendly|humorous|inspirational|salesy|informative",
  "has_cta": true, "language": "uz|ru|en|mixed"}]
Captionlar o'zbek, rus yoki ingliz tilida bo'lishi mumkin.
```

- vLLM javobi validatsiyadan o'tmasa → o'sha chunk Groq fallback'ga (router orqali avtomatik).

### 4.3 `generate_account_profile` — Groq

Kontekst (siqilgan, ~5-8K token): StatsSummary JSON; klassifikatsiya agregatsiyasi (topic/ton taqsimoti, CTA foizi, til taqsimoti); eng yaxshi 10 va eng yomon 3 post captionlari; akkaunt metadata (username, followers, bio).

### 4.4 Profile JSON schema (Pydantic validatsiya)

```json
{
  "niche": "string",
  "sub_niches": ["string"],
  "tone_of_voice": {"primary": "string", "description": "string", "emoji_usage": "none|light|heavy"},
  "content_pillars": [{"name": "string", "share_pct": 0, "performance": "strong|average|weak"}],
  "audience_portrait": {"summary": "string", "likely_interests": ["string"]},
  "language_strategy": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "summary_one_liner": "string"
}
```

System prompt: "Faqat shu schema bo'yicha JSON qaytar. Barcha matn qiymatlari captionlar qaysi tilda ko'p bo'lsa o'sha tilda (yoki o'zbek)."

### 4.5 `generate_recommendations` — Groq

Kontekst: aktiv profil + so'nggi StatsSummary. Chiqish JSON:

```json
{
  "posting_schedule": [{"day": "monday", "hour": 19, "reason": "string"}],
  "format_advice": "string",
  "content_ideas_directions": ["string"],
  "hashtag_advice": "string",
  "growth_actions": [{"action": "string", "priority": "high|medium|low", "expected_impact": "string"}]
}
```

### 4.6 Celery Beat

| Task | Jadval | Vazifa |
|---|---|---|
| `daily_account_snapshot` | har kuni 03:00 | Barcha ulangan IG akkauntlar uchun `account_metrics_snapshots` yozish |
| `weekly_refresh` | har dushanba 04:00 | Har akkaunt: yangi media fetch → stats → profil versiyasi +1 → yangi tavsiyalar. Akkauntlar orasida 60 s stagger |

**Free tier himoyasi**: bitta akkaunt tahlili maksimum ~8-10 LLM chaqiruv. Groq kunlik limiti tugasa (429 doimiy) — task `retry in 6 hours`, job status `queued`, frontend'da "Tahlil navbatda".

---

## 5. FRONTEND — React 18 + TypeScript 5

Mavjud dizayn tizimi: dark theme (`#0A0A0F`), CSS variables (`--bg`, `--surface`, `--ink`, `--mute`, `--faint`, `--line`), Radix UI, Zustand, TanStack Query, Recharts, Sonner, date-fns. Instagram rangi `#E1306C`.

### 5.1 `AIAnalystPage.tsx` — route: `/accounts/:id/ai-analyst`

Akkaunt kartasida (Accounts sahifasi) Instagram akkauntlarga "AI Tahlil" tugmasi.

Sahifa bo'limlari:
1. **Holat banneri**: progress bar (`analysis/status` 3 s polling, `done` da to'xtaydi + refetch). Xato — qizil banner + "Qayta urinish".
2. **Akkaunt DNK kartasi**: niche badge, tone of voice, content pillars (Recharts horizontal bar — share_pct + performance rang), auditoriya portreti, kuchli/zaif tomonlar ikki ustun, `summary_one_liner` katta sitata.
3. **Statistika dashboard**: 7×24 heatmap (kun × soat engagement), format bar chart, follower trend line chart, Top 5 post kartalar (permalink, ER).
4. **Haftalik tavsiyalar**: posting_schedule jadval, growth_actions priority badge bilan.
5. **Kontent g'oyalari generatori**: "G'oya yarat" tugma + mavzu input, POST content-ideas, skeleton loading, natija kartalar, "Nusxalash" (Sonner toast).

### 5.2 UX
- Profil 404: "Tahlil boshlanmagan" empty state + "Tahlilni boshlash" CTA.
- Barcha so'rovlar TanStack Query, xatolar Sonner.
- Mobile responsive.
- Hech qayerda "Groq", "llama", "vLLM" ko'rinmasin — faqat "AI tahlil".

---

## 6. DEVOPS — Ubuntu 22.04, systemd, Nginx (Docker yo'q)

1. `.env` yangi o'zgaruvchilar production'ga (3.1). `GROQ_API_KEY` yo'riqnomasi (console.groq.com → API Keys) `v5_devops.md` ga.
2. Celery Beat jadvali (4.6) mavjud beat konfiguratsiyasiga — V4 token refresh task'lariga teginmasdan.
3. vLLM systemd health check: `GET {VLLM_BASE_URL}/models` script + vLLM o'chiq bo'lsa fallback chain smoke test.
4. Tahlil tasklari alohida queue (`analysis`): `celery -A app worker -Q default,analysis`. Auto-reply (`default`) bloklanmasin.

---

## 7. ACCEPTANCE CRITERIA

- [ ] OAuth callback'dan keyin tahlil avtomatik boshlanadi, callback kechikmaydi.
- [ ] `analysis/status` polling bilan progress; tugagach dashboard ochiladi.
- [ ] Statistika AI'siz ishlaydi — Groq/vLLM o'chiq bo'lsa ham stats ko'rinadi.
- [ ] Provider almashtirish faqat `.env` bilan (AnthropicProvider stub to'liq interfeysli).
- [ ] Groq 429 → exponential backoff + fallback chain, task yiqilmaydi.
- [ ] vLLM noto'g'ri JSON → chunk Groq'qa fallback.
- [ ] Profile/recommendations Pydantic validatsiyadan o'tadi; o'tmasa retry → fallback.
- [ ] Insights scope yetishmasa graceful degradation.
- [ ] Haftalik refresh profil versiyasini +1, eski versiyalar saqlanadi.
- [ ] `analysis` queue alohida — V4 auto-reply bloklanmaydi.
- [ ] Hech bir sir kodda yo'q; tokenlar Fernet bilan o'qiladi.
- [ ] V4 (auto-reply, webhook, OAuth) regression yo'q.

---

## 8. ESLATMALAR

- Insights uchun qo'shimcha scope kerak bo'lsa — mavjud userlar qayta ulanadi, frontend `Reconnect` oqimi (V2 patterni).
- Bu milestone'da AI xarajati 0 so'm. Sonnet'ga o'tilganda: 1 akkaunt boshlang'ich tahlili ≈ $0.10-0.20.
- V5.1+ zaxira (hozir QILINMAYDI): chat-style AI assistant, TikTok/Telegram tahlili, raqobatchi tahlili.
