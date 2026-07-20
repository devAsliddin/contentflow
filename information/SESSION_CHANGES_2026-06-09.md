# Ish hisoboti — 2026-06-09

Branch: `qa-design-and-features` → pushed to `origin`
Commit: `9415c15` — 86 fayl, +3776 / −113 qator

PR yaratish: https://github.com/devAsliddin/contentflow/pull/new/qa-design-and-features

---

## 1. AI provayder — local AI → OpenRouter (tekin)

- Local Ollama o'rniga **OpenRouter tekin modeli** `openai/gpt-oss-120b:free` asosiy qilindi.
- xAI (Grok) klienti ham qo'shildi (`backend/app/services/xai_client.py`) — ixtiyoriy, kalit berilsa ishlaydi.
- Provayder tartibi: **xAI → Anthropic → OpenRouter → Ollama** (`ai_service._build_client`, `ai_chat._call_ai`).
- ⚠️ Muhim topilma: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` **Windows USER-level muhit o'zgaruvchilari**da o'rnatilgan ekan va `.env`ni bekor qilardi (eski `gpt-4o-mini` + eski kalit). To'g'irlandi.
- Haftalik reja endi har post uchun `content_type` + `video_brief` qaytaradi (qaysi kuni qanaqa video tayyorlash).

## 2. Instagram — login, post, metrikalar

- **Login bug tuzatildi:** `/accounts/instagram/login` ilgari Instagram'ga **kirмаsdan** faqat parolni saqlardi → post hech qachon ishlamasdi ("session not found"). Endi haqiqiy `instagrapi` login qiladi va `ig_session` saqlaydi.
- **Shartli 2FA:** kod maydoni **faqat akkauntda 2FA bo'lsa** chiqadi (backend 409 signali) — aks holda so'ralmaydi.
- **Real post performance:** analitikada like/view/comment endi soxta emas — saqlangan sessiya orqali Instagram'dan olinadi (`fetch_media_metrics`).
- **Story/placement:** Story/Reel/feed to'g'ri yo'naltiriladi (image+story → `photo_upload_to_story`).
- **Eslatma:** `contentflow_agent` login'i server IP'dan Instagram challenge (`ChallengeUnknownStep`) beradi — telefonda tasdiqlash kerak. Barqaror yo'l — Graph API (B yo'li, `INSTAGRAM_SETUP.md`).

## 3. New Post — Story va Crop

- **Story bug:** ilgari "Live Preview"dagi Story tab va haqiqiy `placement` bog'lanmagan edi → Story post bo'lib ketardi. Endi Live Preview = yagona manba; tanlangan narsa yuboriladi. Crop'dan keyin ham Story saqlanadi.
- **Crop bug:** crop oynasi balandligi `[160,400]px`ga clamp qilingani uchun 9:16/16:9 kabi nisbatlar buzilardi. Endi crop qutisi har doim aniq nisbatni saqlaydi → kesish to'g'ri.

## 4. AI chat — fayl yuklash, tarix, navigatsiya

- **Fayl yuklash:** agent rejimida 📎 tugma — rasm/video yuklab, "shu kunga rejala" desangiz, agent o'sha media bilan postni jadvalga qo'shadi. Belgilangan vaqtda Celery avtomatik joylaydi.
- Agent endi `platform:account_id` formatida saqlaydi (avval faqat `instagram` → avtopost ishlamasdi).
- **Chat tarixi** `localStorage`da saqlanadi — navigatsiya/yangilashda qoladi.
- **Navigatsiya bug:** 5 ta sidebar/tugma yo'li `/dashboard` prefiksisiz edi (`/calendar`, `/new-post`) → bosh sahifaga tashlardi. Tuzatildi.

## 5. QA testing (qaskills skills)

- O'rnatilgan skill'lar: `playwright-e2e`, `pytest-patterns` (`npx @qaskills/cli add ... --agent claude-code`).
- **Infra bug:** `autoreply` modeli PG-only `JSONB` ishlatardi → SQLite testlari ishlamasdi. `JSONB().with_variant(JSON(), "sqlite")` qilib portativ qilindi.
- **Yangi backend testlar** (`tests/test_qa_*`): IG login, metrikalar, placement, AI provayder, upload validatsiya, AI agent → 31 test.
- **E2E** (`frontend/e2e/critical-flows.spec.ts` + POM): login, navigatsiya regressiyasi, Story switcher, chat tarixi → 9 test.
- **3 oldindan mavjud xato tuzatildi:**
  1. PDF hisobot — `reportlab` o'rnatildi → haqiqiy PDF (200) ishlaydi.
  2. Status transition — noto'g'ri transition 400'ni admin-403'dan oldin tekshiradi.
  3. Migration-status — test fixture endi production'dagidek shifrlangan credential saqlaydi.
- **Yakuniy:** backend **83/83**, E2E **9/9**.

## 6. Dizayn polish (barcha sahifalar, jonli brauzerda)

- **Calendar:** platforma filtri qatori o'ng chekkada kesilardi (X/Twitter + tugmalar) → yorliqlar `2xl`da, sarlavhaga `flex-wrap`.
- **AI chat:** eskirgan `LOCAL · OLLAMA` → haqiqiy `CLOUD · OPENROUTER`; model `qwen2.5:0.5b` → `openai/gpt-oss-120b:free`; "internet talab qilmaydi" (yolg'on) olib tashlandi; sarlavha katta-kichik harf moslandi.
- **Mobil/responsive:** New Post publish-to grid mobilда 1 ustun; New Post + Calendar yon padding mobilда kichraytirildi.

## Servislar (lokal dev)
- Frontend `:5173`, Backend `:8001` (vite proxy `/api`→8001), Celery, Redis, Postgres, ngrok (auto-reply webhook uchun).
- E2E test useri: `test@contentflow.dev / Testpass123!`.
