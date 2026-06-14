# V6 DevOps Agent — env, images queue, FB webhook nginx, media serve, Meta App

> Spec: `v6-spec.md` §6. Backend/Celery tugagan. Tugagach `status/devops.json` yangila.
> Target: Ubuntu 22.04, systemd, Nginx (Docker yo'q prod). Lokal `contentflow/devops/`.

## Kontekst
- `devops/` — nginx conf, systemd unitlar (V4/V5). V5'da `contentflow-celery-analysis.service` + `check_vllm.sh`/`smoke_ai_fallback.sh` qo'shilgan. Mavjud unitlarni BUZMA.
- `.env.example` — backend agent V6 o'zgaruvchilarni qo'shgan; tekshir, yetishmasa qo'sh.

## Vazifalar
1. **Env hujjati**: prod `.env` ga spec §3.1 checklist + Cloudflare Workers AI token yo'riqnoma (dash.cloudflare.com → AI → Workers AI → API token; `CLOUDFLARE_ACCOUNT_ID` dashboard URL'dan). Pollinations key talab qilmasligini hujjatla. `v6_devops.md` (shu fayl) oxiriga yoki `devops/README.md` V6 bo'limiga.
2. **Celery 'images' queue**: V5 `contentflow-celery-analysis.service` patternida — yoki mavjud worker unit'iga `images` qo'sh, yoki alohida `contentflow-celery-images.service` (`-Q images`, concurrency 2). Tavsiya: alohida service (rasm 10-120s, default/analysis bloklanmasin). `deploy.sh`/`restart_services.sh` ga qo'sh.
3. **Nginx FB webhook**: `/api/webhooks/facebook` HTTPS proxy (V4 `/api/webhooks/instagram` patterni — ehtimol allaqachon `/api/` umumiy proxy qamrab oladi; tekshir, alohida kerak bo'lsa qo'sh).
4. **media/ai_generated/**: papka yaratish + ruxsat (app user yozadi, nginx o'qiydi); nginx orqali `/media/ai_generated/` static serve (mavjud `/media` patterni); disk monitor `devops/scripts/check_disk.sh` (>80% → log ogohlantirish) + cron namunasi.
5. **Meta App yo'riqnoma** (`v6_devops.md` da): mavjud Meta App'ga Facebook Login product, Valid OAuth Redirect URI=`FB_OAUTH_REDIRECT_URI`, Webhooks→Page→`feed` subscribe + callback + verify token, App Review `pages_*` materiallar ro'yxati (screen recording, test Page).

## Cheklovlar
- Skriptlarda API key hardcode yo'q (`.env` dan). LF + `#!/usr/bin/env bash`. V4/V5 unitlar buzilmaydi.

## Tekshiruv
- Yangi unit/script sintaktik to'g'ri (`bash -n`).

Status JSON: `status/devops.json`.

---

## Cloudflare Workers AI token — yo'riqnoma

### CLOUDFLARE_ACCOUNT_ID olish

1. https://dash.cloudflare.com sahifasiga kiring.
2. Istalgan domen tanlang (yoki domenlar bo'lmasa bosh sahifaga o'ting).
3. Dashboard URL'ning o'zida Account ID ko'rinadi:
   `https://dash.cloudflare.com/<ACCOUNT_ID>/...`
   — domendan keyingi 32 ta hex belgi sizning Account ID.
4. Shu qiymatni `.env`'ga qo'ying: `CLOUDFLARE_ACCOUNT_ID=a1b2c3...`

### CLOUDFLARE_API_TOKEN (Workers AI) olish

1. Cloudflare dashboard'da: yuqori o'ng burchak → avatar → **My Profile** → **API Tokens**.
2. **Create Token** tugmasini bosing.
3. **Workers AI** shablonini tanlang (yoki Custom Token: `Account > Workers AI > Edit` ruxsati).
4. **Account Resources** ostida o'z akkauntingizni tanlang.
5. **Continue to summary** → **Create Token**.
6. Tokenni DARHOL nusxalang — u faqat bir marta ko'rsatiladi.
7. `.env`'ga qo'ying: `CLOUDFLARE_API_TOKEN=<token>`

### Pollinations.ai haqida

Pollinations.ai — **bepul, API kalit talab qilmaydi.** `POLLINATIONS_BASE_URL=https://image.pollinations.ai` qiymatini o'zgartirmang. Cloudflare ishlamay qolsa yoki konfiguratsiya qilinmasa, fallback zanjiri avtomatik Pollinationsga o'tadi. Hech qanday ro'yxatdan o'tish kerak emas.

---

## Meta App yo'riqnoma (Facebook Login + Webhooks + App Review)

### 1. Facebook Login product qo'shish

1. https://developers.facebook.com — V4 Instagram uchun ishlatilgan ilovangizni oching.
2. **Add a product** → **Facebook Login** → **Set up** → **Web**.
3. **Facebook Login → Settings** bo'limida:
   - **Valid OAuth Redirect URIs**: `https://YOUR_DOMAIN/api/accounts/facebook/oauth/callback` qo'shing.
     (`.env`'dagi `FB_OAUTH_REDIRECT_URI` bilan AYNAN bir xil bo'lishi shart.)
   - **Allowed Domains**: production domeningizni qo'shing.
   - **Save changes**.

### 2. Talab qilinadigan OAuth ruxsatlar (scope)

Backend quyidagi scopelarni so'raydi (`ads_management` YO'Q — V6.1'ga qoldirilgan):
- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`
- `pages_manage_engagement`
- `pages_manage_metadata`

### 3. Webhooks → Page → feed obunasi

1. App dashboard → **Products** → **Webhooks** → **Add Subscriptions** → **Page**.
2. **Callback URL**: `https://YOUR_DOMAIN/api/webhooks/facebook`
3. **Verify Token**: `.env`'dagi `FB_WEBHOOK_VERIFY_TOKEN` qiymati bilan bir xil bo'lishi shart.
4. **Verify and Save** — Meta GET so'rov yuboradi; FastAPI `hub.challenge` qaytaradi.
   (Nginx yangi config bilan qayta yuklangan bo'lishi shart.)
5. **Page subscription fields** ostida: **`feed`** ni yoqing.
6. **Save**.

Eslatma: har bir Page uchun dasturiy webhook obunasi (`POST /{page_id}/subscribed_apps`)
`select-page` endpoint'da avtomatik bajariladi. Bu yerda faqat App-darajadagi callback ro'yxatdan o'tadi.

### 4. App Review — `pages_*` ruxsatlari

App admin/tester bo'lmagan foydalanuvchilar uchun Meta App Review talab qilinadi.

| Ruxsat | Taqdim etish kerak |
|---|---|
| `pages_show_list` | Ekran yozuvi: OAuth → ContentFlow akkauntlar sahifasida Page ko'rinadi. |
| `pages_read_engagement` | Ekran yozuvi: auto-reply ishga tushadi, kommentga javob Facebook'da ko'rinadi. |
| `pages_read_user_content` | Ekran yozuvi: komment matni ContentFlow logs'da ko'rinadi. |
| `pages_manage_engagement` | Ekran yozuvi: haqiqiy Page kommentiga javob yuborildi. Foydalanish maqsadi: biznes Page'lar uchun komment auto-reply. |
| `pages_manage_metadata` | Ekran yozuvi: webhook obunasi tasdiqlandi, feed voqeasi qabul qilindi. |

**Test Page:** Ekran yozuvlari uchun alohida Facebook Page yarating (shaxsiy profil emas).

**App Review yuborish:**
1. App dashboard → **App Review** → **Requests**.
2. Har bir `pages_*` ruxsatni alohida qo'shing.
3. Foydalanish holatini sodda tilda izohlang + ekran yozuvini biriktiring.
4. **App Settings → Basic** da Privacy Policy URL va App Icon to'ldirilgan bo'lishi shart.
5. Yuborish. Ko'rib chiqish: 5–10 ish kuni.

Tekshirish davomida: **Roles → Test Users** orqali sinov foydalanuvchilarini qo'shing.
