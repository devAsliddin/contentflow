# Instagram ulanish — 2 ta yo'l

## A yo'li — Username/parol bilan (post qo'yish uchun)

1. Accounts sahifasida `+ Add Instagram` → username + parolni kiriting.
2. Agar akkauntda **2FA yoqilgan** bo'lsa, telefoningizdagi authenticator/SMS'dagi
   **6 xonali kodni** "2FA code" maydoniga kiriting.
3. Instagram yangi qurilmadan kirishni sezsa, **telefonda Instagram ilovasi**
   "Bu sizmidingiz?" so'raydi → **Yes / This was me** bosing, keyin qayta urinib ko'ring.
4. Ulangach, post qo'yish (rasm/video) va jadval bo'yicha avtomatik joylash ishlaydi.

> Eslatma: Instagram ba'zan server IP'sidan parol bilan kirishni bloklaydi
> (challenge). Bunda yagona ishonchli yo'l — pastdagi **B yo'li** (rasmiy API).

---

## B yo'li — Rasmiy Instagram Graph API (auto-reply + post uchun)

Auto-reply (DM va komment) **faqat** shu yo'l bilan ishlaydi. Quyidagilar kerak:

- Instagram **Business** yoki **Creator** akkaunt (Facebook Page'ga ulangan)
- developers.facebook.com'da **Meta App**

### 1. Meta App yarating
1. https://developers.facebook.com/apps → **Create App** → "Business" turi.
2. App'ga **Instagram** mahsulotini qo'shing (Instagram API / Graph API).
3. App'dan **App ID** va **App Secret** ni oling.

### 2. Redirect URI va Webhook'ni ro'yxatdan o'tkazing
App sozlamalarida quyidagilarni **aynan** kiriting (ngrok URL hozir ishlayapti):

| Maydon | Qiymat |
|--------|--------|
| **OAuth Redirect URI** | `https://0aa8-62-164-155-175.ngrok-free.app/api/accounts/instagram/oauth/callback` |
| **Webhook Callback URL** | `https://0aa8-62-164-155-175.ngrok-free.app/api/webhooks/instagram` |
| **Webhook Verify Token** | `CHOflCRWw0o30tRNQJ7euOspouqiNHP6` |
| **Webhook fields** | `messages`, `comments` |

> ⚠️ ngrok bepul URL har qayta ishga tushganda **o'zgaradi**. URL o'zgarsa,
> `.env` dagi `INSTAGRAM_OAUTH_REDIRECT_URI` ni va Meta App'dagi URL'larni yangilang.
> Doimiy URL uchun ngrok static domain yoki haqiqiy domen ishlating.

### 3. `.env` ni to'ldiring
`backend/.env` da:
```
META_APP_ID=<App ID>
META_APP_SECRET=<App Secret>
```
(Redirect URI va verify token allaqachon to'ldirilgan.)

### 4. Backend'ni qayta ishga tushiring
`.env` o'zgarsa backend qayta ishga tushishi shart.

### 5. Ulanish
Autoreply sahifasida **Connect Instagram** → instagram.com'da ruxsat bering.
Webhook avtomatik obuna bo'ladi. Keyin kalit so'z → javob qoidalarini qo'shing.
