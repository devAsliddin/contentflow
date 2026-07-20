# V6 Frontend Agent — FB ulanishi, AI reply UI, AI Post Creator wizard

> Spec: `v6-spec.md` §5. Backend endpointlar tayyor. Tugagach `status/frontend.json` yangila.

## Kontekst (mavjud kod — o'rgan)
- `frontend/src/` Vite+React18+TS5. Router (`App.tsx`, `/dashboard/*` ProtectedRoute+Layout — V5 `AIAnalystPage` shu yerda ulangan, namuna).
- API client: `src/services/*.service.ts` (axios instance, token refresh). Tiplar `src/types/*.types.ts`.
- V5: `src/services/analysis.service.ts`, `src/pages/AIAnalystPage.tsx` (TanStack Query polling, Recharts) — namuna.
- V4 autoreply UI: `src/components/autoreply/*`, `src/services/autoreply.service.ts`, `src/types/autoreply.types.ts` — kengaytiriladi.
- `src/pages/AccountsPage.tsx` — akkaunt kartalari (V5 "AI Tahlil" tugma namunasi). OAuth start: V5 IG ulanish `window.location` + token query-param patterni.
- Dizayn: dark `#0A0A0F`, CSS vars, Radix UI, Zustand, TanStack Query, Sonner. FB rangi `#1877F2`. Composer sahifasi: `NewPostPage.tsx`/`DraftsPage.tsx` (send-to-composer redirect manzili shu).

## Vazifalar
1. **Tiplar+servislar**: `src/types/facebook.types.ts`, `src/types/ai-posts.types.ts`; `src/services/facebook.service.ts` (oauthStart URL, selectPage), `src/services/ai-posts.service.ts` (generate, regenerateCaption, generateImage, getImageJob, regenerateImage, sendToComposer, list, delete). Backend javoblariga aniq mos.
2. **AccountsPage** (spec §5.1): "Connect with Facebook" tugma (#1877F2 oq matn). URL'da `?fb_select_page=<key>` bo'lsa Radix Dialog **Page Picker** (ro'yxat backend select-page uchun sessiyadan kelmaydi — backend redirect qilganda ro'yxatni qayerdan olishni aniqlashtir: agar backend ro'yxatni qaytarmasa, frontend `GET` bilan ololmaydi → backend select-page oqimida ro'yxatni ham qaytaradigan endpoint kerak bo'lsa backend bilan moslash; oddiy yo'l: callback redirect query'da minimal page nomlari yo'q, shuning uchun `fb_select_page` key bilan `GET /api/accounts/facebook/pages?session_key=` qo'shilishi mumkin — backend bilan tekshir, bo'lmasa Dialog faqat key'ni select-page POST'iga yuboradi). Tanlash→selectPage POST→Sonner "Facebook Page ulandi"→refetch. Ulangan FB karta: Page nomi, webhook holati, token_status='expired'→Reconnect.
3. **Auto-reply UI** (spec §5.2): platform tab/filter IG|FB. Rule forma `reply_mode` switch (Tayyor matn|AI javob) — AI tanlansa reply_text o'rniga `ai_context` textarea + ogohlantirish banner ("AI javoblari akkaunt toningizda yoziladi. Logs'da kuzating."). Logs panel: platform + reply_mode badge.
4. **`AIPostCreatorPage.tsx`** route `/dashboard/ai-posts/create` (spec §5.3) — 3 qadam wizard (Radix): (1) akkaunt select + platform target checkbox + topic input yoki "AI taklif qilsin" (V5 `analysis.service` recommendations `content_ideas_directions` chiplar) → generate; (2) 3 caption variant radio + tahrir textarea, hashtag chip qo'sh/o'chir, "Qayta yozish"+feedback; (3) "Rasm yaratish"→generateImage→getImageJob 3s polling→preview 1:1+"Qayta yaratish"+style_hint, "Rasmsiz davom". Yakun "Composer'ga yuborish"→sendToComposer→composer (NewPost/Drafts) redirect.
5. **`/dashboard/ai-posts`** ro'yxat sahifasi (spec §5.4): thumbnail, caption qisqartma, status badge, Davom/O'chirish.
6. Routerga 2 yangi route + navigatsiya menyusiga "AI Post" havola.

## Cheklovlar
- Provider nomlari (Groq/Cloudflare/Flux/Pollinations) HECH QAYERDA — faqat "AI". UI matnlari o'zbekcha.
- Skeleton+progress; xatolar Sonner; rasm xato "Rasm yaratilmadi, qayta urinib ko'ring"+retry (texnik xato ko'rsatilmaydi). Mobile responsive.
- Yangi dependency QO'SHMA.

## Tekshiruv
- `cd frontend && npx tsc --noEmit` xatosiz (sen kiritmagan mavjud xatolar bo'lsa hisobotda ayt).

Status JSON: `status/frontend.json`.
