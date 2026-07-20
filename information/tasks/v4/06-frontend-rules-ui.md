# 06 — Frontend: Rules UI

**Agent:** frontend · **Status:** done · **Papka:** `src/components/autoreply/`

## `AutoReplyRulesPage.tsx`
- Route: `/dashboard/autoreply` (`App.tsx`), Sidebar "Workflow" bo'limida "Auto-reply" (Bot ikonkasi).
- Instagram akkaunt(lar) `accountsService.list('instagram')` orqali; auto-reply uchun
  ulanganlar = `ig_user_id` mavjudlar. Hech biri bo'lmasa → `ConnectInstagramButton` CTA.
- Bir nechta akkaunt bo'lsa selector. Qoida kartochkalari: nomi, target badge (DM/Comment),
  match_type, priority, kalit so'z chiplari, javob matni (truncate), `is_active` switch,
  tahrirlash/o'chirish.
- "Loglar" tugmasi `AutoReplyLogsPanel` ga almashtiradi.

## `RuleEditorDialog.tsx` (Radix Dialog)
Maydonlar (handlerlar, HTML form emas): name, target (segmented DM|Comment),
match_type (select), keywords (chip input, Enter; `any` da disable+yashirin),
case_sensitive (Switch), reply_text (textarea + 1000 counter), comment_action
(faqat comment), priority (number + tooltip). Saqlash → TanStack Query mutation →
Sonner toast + `['autoreply-rules', accountId]` invalidate.

## API qatlami
`src/services/autoreply.service.ts` (alohida axios instance, baseURL `/api`),
`src/types/autoreply.types.ts`. Dizayn tizimiga mos (dark theme, Btn, StatusPill).
TypeScript `tsc --noEmit` toza.
