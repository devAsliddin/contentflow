# Meta App Review — ContentFlow (Instagram API)

App: **contentflow** (App ID 1512037607373258), Instagram app ID 1530307402009179
Domain: https://sms-bot-5.uz

## 1. Basic settings (App settings → Basic) — REQUIRED before submission
| Field | Value |
|-------|-------|
| App icon (1024×1024) | upload `app_icon.png` (tayyor) |
| Privacy Policy URL | https://sms-bot-5.uz/privacy |
| User data deletion | **Data deletion instructions URL** → https://sms-bot-5.uz/data-deletion |
| Category | Business and pages (yoki Utilities & productivity) |
| App domains | sms-bot-5.uz (allaqachon bor) |

## 2. Business Verification (Meta Business Manager) — REQUIRED for advanced access
- Business Manager → Security Center → Start verification.
- Yuridik hujjat (firma guvohnomasi / STIR) + manzil tasdig'i kerak.
- Jismoniy shaxs bo'lsangiz: "Individual" developer sifatida ham ba'zi ruxsatlar standart access'da ishlaydi, lekin manage_comments/messages advanced uchun business verification talab qilinadi.

## 3. Requested permissions + use descriptions (App Review → Permissions)
Har bir ruxsat uchun "How will you use this permission?" ga quyidagini yozing:

- **instagram_business_basic** — "To identify the connected Instagram Professional account (account id, username) so the user can manage it inside ContentFlow."
- **instagram_business_manage_comments** — "To read incoming comments on the user's own Instagram media and post automated keyword-based replies that the user configures in ContentFlow (auto-reply rules)."
- **instagram_business_manage_messages** — "To read and respond to direct messages on the user's own account using the user-configured auto-reply rules."
- **instagram_business_content_publish** — "To publish posts, reels and stories that the user creates and schedules in ContentFlow to their own Instagram Professional account."
- **instagram_business_manage_insights** — "To show the user analytics (reach, views, likes, comments) for their own published media inside the ContentFlow dashboard."

## 4. Reviewer test instructions (App Review → "Provide instructions")
```
Test account (ContentFlow): create one at https://sms-bot-5.uz/register
Steps:
1. Log in at https://sms-bot-5.uz
2. Go to Accounts → click "Instagram bilan ulash" (Connect Instagram).
3. Authorize with an Instagram Professional account (Business/Creator) linked to a Facebook Page.
4. After redirect back, the account appears as connected.
5. Go to "Avtomatik javob" (Auto-reply) → create a rule (keyword → reply text) → enable it.
6. Comment the keyword on one of the account's posts → ContentFlow auto-replies.
7. (Content publish) Go to New Post / AI Posts → create a post/reel/story → publish to Instagram.
8. (Insights) Open the account's AI Analyst page to see media metrics.
```

## 5. Screencast (demo video) — REQUIRED per permission
Ekran yozuvi (screen recording) qiling, quyidagini ko'rsating:
- Login → Connect Instagram (OAuth consent screen) → connected.
- Creating + enabling an auto-reply rule, then a comment triggering the reply (manage_comments/messages).
- Publishing a post/reel/story (content_publish).
- Viewing insights (manage_insights).
Videoni YouTube'ga (unlisted) yuklab, havolasini App Review formasiga qo'ying.

## 6. Submit
App Review → Request advanced access for the permissions above → attach video + instructions → Submit.
Meta odatda 1–5 ish kunida javob beradi.

## Holat (2026-06-15)
- ✅ Privacy Policy URL live: https://sms-bot-5.uz/privacy
- ✅ Data Deletion URL live: https://sms-bot-5.uz/data-deletion
- ✅ App icon tayyor: `app_icon.png` (1024×1024)
- ✅ OAuth connect + comment reply + content publish ishlaydi (dev mode'da tester bilan tasdiqlangan)
- ⏳ Basic settings'ga icon/urls/category kiritish (dashboard)
- ⏳ Business Verification (foydalanuvchi hujjatlari)
- ⏳ Demo video (foydalanuvchi yozadi)
