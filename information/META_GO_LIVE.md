# Meta App — Development → Live (App Review) qo'llanma

App: **ContentFlow** — `App ID 1512037607373258`
Domen: **postix.uz** | Oxirgi yangilanish: 2026-08-06

Bu hujjat Meta App'ni Live rejimga o'tkazish uchun **tayyorlangan hamma narsa** va
**sizga qolgan qo'lda qadamlarni** o'z ichiga oladi. Kod/infra tomoni tayyor va deploy qilingan.

---

## 0. Kod tomoni — TAYYOR (men qildim, deploy qilindi)

| Talab | Holat | Qiymat |
|---|---|---|
| IG OAuth redirect | ✅ | `https://postix.uz/api/accounts/instagram/oauth/callback` |
| FB OAuth redirect | ✅ | `https://postix.uz/api/accounts/facebook/oauth/callback` |
| Privacy Policy sahifasi | ✅ 200 | `https://postix.uz/privacy` |
| Terms sahifasi | ✅ 200 | `https://postix.uz/terms` |
| Data Deletion **Instructions** sahifasi | ✅ 200 | `https://postix.uz/data-deletion` |
| Deauthorize **callback** (signed_request) | ✅ yangi | `https://postix.uz/api/webhooks/deauthorize` |
| Data Deletion **callback** (signed_request) | ✅ yangi | `https://postix.uz/api/webhooks/data-deletion` |

---

## 1. "Live" ikki qatlam ekanini tushuning

- **App Mode = Live** toggle — Standard Access ruxsatlar uchun yetarli, tezda bosiladi.
- **Advanced Access** (haqiqiy publish/DM/insights) — **App Review** talab qiladi,
  Meta odam tekshiradi (kunlar–haftalar). Bu o'tmaguncha faqat Tester akkauntlar ishlaydi.

Ilova so'raydigan ruxsatlar (App Review kerak):
`instagram_business_content_publish`, `instagram_business_manage_messages`,
`instagram_business_manage_comments`, `instagram_business_manage_insights`,
`pages_show_list`, `pages_read_engagement`.

---

## 2. SIZGA QOLGAN QO'LDA QADAMLAR (Meta login talab qiladi)

### A. Basic Settings to'ldirish
developers.facebook.com → App (1512037607373258) → **Settings → Basic**:
- [ ] **Privacy Policy URL** = `https://postix.uz/privacy`
- [ ] **Terms of Service URL** = `https://postix.uz/terms`
- [ ] **User Data Deletion** → "Data Deletion Instructions URL" = `https://postix.uz/data-deletion`
      (yoki "Data Deletion Callback URL" = `https://postix.uz/api/webhooks/data-deletion`)
- [ ] **Deauthorize Callback URL** = `https://postix.uz/api/webhooks/deauthorize`
- [ ] **App Icon** (1024×1024 PNG), **Category** (masalan "Business and Pages")
- [ ] **App Domains** = `postix.uz`
- [ ] **Contact Email** to'ldirilgan
- [ ] Pastda **Save Changes**

### B. Business Verification (faqat siz — hujjat kerak)
Business Manager → **Security Center → Business Verification**:
- [ ] Tashkilot ma'lumotlari + rasmiy hujjat (ro'yxatdan o'tish guvohnomasi / STIR va h.k.)
- [ ] Meta tasdiqlashini kuting (odatda 1–3 kun). Advanced Access shusiz berilmaydi.

### C. App Mode → Live
- [ ] App yuqorisidagi **App Mode** toggle: **Development → Live**
  (Basic Settings + Privacy URL to'liq bo'lsa toggle ochiladi)

### D. App Review — har bir ruxsat uchun (3-bo'limdagi matnlarni ishlating)
Dashboard → **App Review → Permissions and Features** → har biriga "Request Advanced Access":
- [ ] Ruxsatni tanlang → use-case matnini joylashtiring (§3)
- [ ] **Screencast** yuklang (§4 ssenariy bo'yicha ekran-yozuv)
- [ ] **Test user** bering: `deploytest_*@sms-bot-5.uz / Testpass123!` (yoki yangi test akkaunt)
- [ ] **Submit for Review**
- [ ] Meta javobini kuting; rad etilsa — izohga ko'ra tuzatib qayta yuboring

---

## 3. App Review — use-case matnlari (INGLIZCHA, paste-uchun-tayyor)

> Meta reviewerlari inglizcha o'qiydi. Har birini tegishli ruxsat ostiga joylashtiring.

**instagram_business_content_publish**
> ContentFlow is a social media scheduling SaaS. Business users connect their own
> Instagram Business/Creator account via Instagram Business Login and schedule posts,
> reels and stories. We use instagram_business_content_publish to publish the content
> the user created and approved in our composer at the time they scheduled. Users see a
> full preview and explicitly click "Publish"/"Schedule" before anything is sent. No
> content is posted without the account owner's action.

**instagram_business_manage_messages**
> Users enable optional auto-replies to Instagram DMs from within ContentFlow. We use
> instagram_business_manage_messages to read incoming direct messages on the user's own
> connected Business account and send the reply the user configured (rule-based or
> AI-assisted). Only the account owner configures and enables these rules.

**instagram_business_manage_comments**
> ContentFlow lets the account owner view and reply to comments on their own Instagram
> media and (optionally) auto-reply to comments using rules they define. We use
> instagram_business_manage_comments strictly on the connected owner's account.

**instagram_business_manage_insights**
> We display analytics (reach, impressions, engagement, follower trends) for the user's
> own connected Instagram Business account inside ContentFlow's Analytics dashboard. We
> use instagram_business_manage_insights only to read metrics for that owned account.

**pages_show_list**
> During Facebook connection the user selects which of their own Facebook Pages to link
> to ContentFlow. pages_show_list is used to display the list of Pages the user manages
> so they can choose.

**pages_read_engagement**
> We read basic engagement data for the user's own selected Facebook Page to show
> post-level analytics inside ContentFlow's dashboard.

---

## 4. Screencast ssenariylari (ekran-yozuv uchun)

> Har bir ruxsat uchun Meta reviewer aynan shu oqimni ko'rishni xohlaydi. postix.uz'da
> test akkaunt bilan yozing (login → amal → natija). 1–2 daqiqa yetadi.

**content_publish:** Login (postix.uz) → Accounts → "Connect Instagram" → OAuth consent
→ akkaunt ulanadi → New Post → matn+rasm → Preview → "Publish now" bosing → Instagram'da
post paydo bo'lganini ko'rsating.

**manage_messages:** Dashboard → Auto-reply → yangi rule yoqing → ulangan IG akkauntga
tashqi telefondan DM yuboring → ContentFlow avtomatik javob berganini ko'rsating.

**manage_comments:** Ulangan akkaunt mediasi ostiga izoh → ContentFlow'da izoh ko'rinadi
→ javob berish / auto-reply rule ishlaganini ko'rsating.

**manage_insights:** Analytics sahifasi → ulangan IG akkaunt metrikalari (reach/impressions)
ko'rsatilgan grafiklarni ko'rsating.

**pages_show_list / pages_read_engagement:** Accounts → "Connect Facebook" → OAuth →
Page tanlash ro'yxati → Page ulanadi → Analytics'da Page metrikalari.

---

## 5. Callback'larni tez tekshirish (deploydan keyin)

```
# imzosiz → 400/422 (endpoint jonli, imzoni talab qiladi)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://postix.uz/api/webhooks/data-deletion
# deauthorize bo'sh body → 200 (Meta probe'ini qabul qiladi)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://postix.uz/api/webhooks/deauthorize
```

---

## 6. Xulosa — kim nima qiladi

| Ish | Kim |
|---|---|
| Callback kodi + redirect/URL'lar + huquqiy sahifalar | ✅ men (tayyor, deploy) |
| App Review use-case matnlari + ssenariy | ✅ men (§3–4) |
| Basic Settings dashboard'ga kiritish | 🔴 **siz** (§2A) |
| Business Verification (hujjat) | 🔴 **siz** (§2B) — bu bloklovchi |
| App Mode → Live toggle | 🔴 **siz** (§2C) |
| Screencast yozib App Review Submit | 🔴 **siz** (§2D) |
| Meta'ning odam-tekshiruvi (kunlar–haftalar) | ⏳ Meta |
