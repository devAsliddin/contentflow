# V5 Frontend Agent — AI Analyst sahifasi

> Spec: `information/tasks/v5/v5-spec.md` §5. Backend endpointlar tayyor. Ish tugagach `status/frontend.json` ni yangila.

## Kontekst (mavjud kod)

- `frontend/src/` — React 18 + TS 5 + Vite. Sahifalar: `src/pages/*.tsx`, routelar qayerda ro'yxatga olinganini top (`App.tsx` yoki router fayl).
- Dizayn: dark theme `#0A0A0F`, CSS variables `--bg --surface --ink --mute --faint --line`, Radix UI, Zustand, TanStack Query, Recharts, Sonner, date-fns. Instagram rangi `#E1306C`. Mavjud sahifalardan (masalan `AnalyticsPage.tsx`, `AccountsPage.tsx`) pattern ol.
- API service pattern: `src/services/*.service.ts` (masalan `autoreply.service.ts`), tiplar `src/types/*.types.ts`.
- V4 autoreply komponentlari: `src/components/autoreply/` — Connect/Reconnect patterni shu yerda.

## Vazifalar

### 1. Tiplar — `src/types/analysis.types.ts`

Backend javoblariga mos: `AnalysisJob` (status, progress_pct, error_message), `StatsSummary` (HourScore, FormatScore, HashtagScore, TopPost, DateValue, er_basis), `AccountProfile` (spec §4.4 schema), `Recommendations` (spec §4.5), `ContentIdea`.

### 2. Service — `src/services/analysis.service.ts`

6 endpoint (spec §3.5): startAnalysis, getStatus, getStats, getProfile, getRecommendations, generateContentIdeas. Mavjud HTTP client/axios instansiyasini ishlat.

### 3. Sahifa — `src/pages/AIAnalystPage.tsx`, route `/accounts/:id/ai-analyst`

Bo'limlar (spec §5.1):
1. **Holat banneri** — `getStatus` TanStack Query `refetchInterval: 3000`, status `done|failed` bo'lganda polling to'xtaydi; `done` ga o'tganda stats/profile/recommendations refetch. `failed` → qizil banner + "Qayta urinish" (startAnalysis). Aktiv job → progress bar (progress_pct).
2. **Akkaunt DNK kartasi** — profil: niche badge, tone_of_voice, content pillars Recharts horizontal bar (share_pct; performance: strong=yashil, average=neytral, weak=qizil), auditoriya portreti, strengths/weaknesses ikki ustun, summary_one_liner katta sitata.
3. **Statistika dashboard** — stats:
   - 7×24 heatmap (kun × soat, avg ER intensivligi) — CSS grid bilan (Recharts'da heatmap yo'q), hujayra rangi intensivlikka qarab.
   - Format performance bar chart (Recharts).
   - Follower trend line chart (Recharts, follower_trend).
   - Top 5 post kartalari (permalink tashqi havola, ER foiz).
4. **Haftalik tavsiyalar** — posting_schedule jadval, format_advice/hashtag_advice matn bloklari, growth_actions ro'yxati priority badge (high qizil/medium sariq/low neytral).
5. **Kontent g'oyalari** — count select (1-5), ixtiyoriy mavzu input, "G'oya yarat" tugma → POST, skeleton loading, natija kartalar + "Nusxalash" (`navigator.clipboard` + Sonner "Nusxalandi").

### 4. Empty/xato holatlar

- Profil 404 va aktiv job yo'q → "Tahlil boshlanmagan" empty state + "Tahlilni boshlash" CTA.
- Stats 404 → stats bo'limida ham empty holat.
- Barcha mutation xatolari Sonner orqali (o'zbek tilida xabarlar).
- content-ideas 429 → "Soatlik limit tugadi, keyinroq urinib ko'ring".

### 5. Kirish nuqtasi

`AccountsPage.tsx` da Instagram akkaunt kartalariga "AI Tahlil" tugma/link (`/accounts/{id}/ai-analyst`, rang `#E1306C` aksent). Routerga yangi route qo'sh (auth-protected, mavjud pattern).

### 6. Talablar

- UI matnlari o'zbekcha. Hech qayerda "Groq/llama/vLLM" so'zi yo'q — faqat "AI tahlil".
- Mobile responsive (mavjud breakpoint patternlari).
- `cd frontend && npx tsc --noEmit` (yoki mavjud build/lint skripti) xatosiz o'tsin.

## Status JSON: `information/tasks/v5/status/frontend.json`.
