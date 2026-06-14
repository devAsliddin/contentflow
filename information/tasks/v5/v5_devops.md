# V5 DevOps Agent — env, queue, vLLM health, beat

> Spec: `information/tasks/v5/v5-spec.md` §6. Backend/Celery ishi tugagan. Ish tugagach `status/devops.json` ni yangila.
> Target: Ubuntu 22.04, systemd, Nginx (Docker YO'Q production'da). Lokal repo'da `devops/` papka mavjud.

## Kontekst (mavjud kod)

- `devops/` — nginx conf, systemd unit fayllar/skriptlar (V4'da yaratilgan). Mavjud Celery unit'lar qanday yozilganini ko'r.
- `.env.example` (root) — backend agent yangi o'zgaruvchilarni qo'shgan bo'lishi kerak; tekshir, yetishmasa qo'sh (spec §3.1 ro'yxati).

## Vazifalar

### 1. Env hujjati va GROQ_API_KEY yo'riqnomasi

Shu faylning oxiriga (pastdagi "GROQ_API_KEY olish" bo'limi) yo'riqnoma yozilgan — production `.env` ga §3.1 o'zgaruvchilarini qo'shish checklist'i bilan birga `devops/` ostidagi deploy hujjatiga ham qo'sh (mavjud deploy doc bo'lsa o'shanga).

### 2. Celery worker — alohida `analysis` queue

- Systemd unit (yoki mavjud worker unit'ni yangilash skripti): worker `-Q default,analysis` bilan ishlasin, YOKI alohida `contentflow-celery-analysis.service` (faqat `-Q analysis`, concurrency 2) — auto-reply (`default`) bloklanmasligi kafolati uchun alohida service afzal.
- Beat: yangi jadval (daily_account_snapshot, weekly_refresh) kod ichida (`celery_app.py`) — beat unit o'zgarmaydi, faqat restart kerakligini hujjatla.

### 3. vLLM health check

- `devops/scripts/check_vllm.sh`: `curl -sf --max-time 5 $VLLM_BASE_URL/models` → exit 0/1, jurnalga yozadi.
- Systemd timer yoki cron (har 5 min) misoli hujjatda.
- Smoke test skripti `devops/scripts/smoke_ai_fallback.sh`: vLLM o'chiq holatda backend'dagi fallback chain ishlashini tekshirish bo'yicha qadamlar (kommentlarda) + oddiy curl test.

### 4. Tekshiruv

- Hech bir skriptda API key hardcode emas (`.env` dan o'qiladi).
- V4 unit fayllar buzilmagan.

## Status JSON: `information/tasks/v5/status/devops.json`.

---

## GROQ_API_KEY olish (yo'riqnoma)

1. https://console.groq.com ga kiring (Google akkaunt bilan bepul ro'yxatdan o'tish mumkin).
2. Chap menyuda **API Keys** → **Create API Key**.
3. Nom bering (masalan `contentflow-prod`), yaratilgan kalitni darhol nusxalang (qayta ko'rsatilmaydi).
4. Production serverda `.env` ga: `GROQ_API_KEY=gsk_...`
5. Free tier limitlari (2026): modelga qarab kuniga ~1K-14K so'rov, daqiqasiga ~30 so'rov — tahlil chain shu limitga sig'adigan qilib yozilgan (akkaunt boshiga ≤10 chaqiruv).
6. Backend va Celery service'larni restart qiling: `sudo systemctl restart contentflow-backend contentflow-celery contentflow-celery-analysis contentflow-celery-beat` (mavjud unit nomlariga moslang).
