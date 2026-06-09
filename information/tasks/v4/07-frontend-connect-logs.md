# 07 — Frontend: Connect + Logs

**Agent:** frontend · **Status:** done

## `ConnectInstagramButton.tsx`
- Bosilganda `window.location.href = autoreplyService.instagramOAuthStartUrl()`
  (`/api/accounts/instagram/oauth/start?token=<JWT>`).
- Eslatma matni: **"Instagram parolingiz so'ralmaydi — Instagram'ning o'zida ruxsat
  berasiz. Akkaunt Professional (Business/Creator) bo'lishi va Facebook sahifaga
  ulangan bo'lishi kerak."** + "Faqat token saqlanadi" qatori.
- `compact` prop — sahifa tepasidagi kichik tugma uchun.
- OAuth `?connected=instagram` bilan qaytganda `AutoReplyRulesPage` Sonner success toast ko'rsatadi.

## `AutoReplyLogsPanel.tsx`
So'nggi 50 log jadvali: vaqt, event_type, kelgan matn (+ error_detail), status
(`StatusPill` — sent=yashil/live, skipped_*=kulrang/draft, failed=qizil). `refetchInterval`
15s. `autoreplyService.listLogs(accountId, 50)`.
