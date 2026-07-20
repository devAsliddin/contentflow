#!/usr/bin/env bash
# smoke_ai_fallback.sh — AI fallback chain smoke test
#
# PURPOSE:
#   vLLM o'chiq (yoki yetishmay turgan) holatda backend'ning Groq fallback
#   chain'i ishlashini tekshirish. Faqat manual ishga tushiriladi (CI/deploy
#   paytida yoki vLLM o'chirilganda).
#
# USAGE:
#   bash devops/scripts/smoke_ai_fallback.sh [API_BASE_URL]
#
# DEFAULT API_BASE_URL: http://localhost:8000
#
# REQUIREMENTS:
#   - curl, jq (apt install -y jq)
#   - Backend ishlab turishi kerak
#   - .env'dan GROQ_API_KEY to'g'ri set qilingan bo'lishi shart
#   - vLLM ataylab o'chirilgan yoki VLLM_BASE_URL=http://127.0.0.1:1 (wrong port)
#   - Valid test user session token (TEST_TOKEN env var)
#
# HOW FALLBACK WORKS (spec §3.2):
#   1. classify_captions tries vLLM (AI_CLASSIFICATION_PROVIDER=vllm)
#   2. vLLM unreachable / timeout → router logs WARNING, switches to Groq
#   3. Groq 429 → exponential backoff → OpenRouter → vLLM last resort
#   4. Stats (Python/SQL, no AI) always available regardless of AI status

set -uo pipefail

API_BASE="${1:-http://localhost:8000}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
PASS=0
FAIL=0

log()  { echo "[$TIMESTAMP] $*"; }
ok()   { log "[PASS] $*"; PASS=$((PASS+1)); }
fail() { log "[FAIL] $*"; FAIL=$((FAIL+1)); }

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0: Confirm vLLM is actually down (prerequisite for this smoke test)
# ─────────────────────────────────────────────────────────────────────────────
log "==> Step 0: Confirm vLLM is unreachable"
# Re-use check_vllm.sh if present next to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if bash "$SCRIPT_DIR/check_vllm.sh" > /dev/null 2>&1; then
  log "WARNING: vLLM appears reachable. This smoke test is designed for the"
  log "         fallback scenario (vLLM down). Results may not reflect fallback path."
  log "         To test fallback: stop vLLM or set VLLM_BASE_URL to a wrong address."
else
  ok "vLLM is down — fallback chain will activate as expected"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Backend health check — backend must be up
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "==> Step 1: Backend health check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_BASE/api/health" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "Backend is healthy (HTTP $HTTP_CODE)"
else
  fail "Backend health check failed (HTTP $HTTP_CODE). Aborting."
  log "Result: PASS=$PASS FAIL=$FAIL"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Stats endpoint — must work with NO AI (pure Python/SQL)
#
# This verifies the spec requirement:
#   "Statistika AI'siz ishlaydi — Groq/vLLM o'chiq bo'lsa ham stats ko'rinadi"
#
# Requires: valid TEST_ACCOUNT_ID and TEST_TOKEN env vars.
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "==> Step 2: Stats endpoint (AI-free path)"

if [ -z "${TEST_TOKEN:-}" ] || [ -z "${TEST_ACCOUNT_ID:-}" ]; then
  log "SKIP: TEST_TOKEN or TEST_ACCOUNT_ID not set."
  log "      Set them to run authenticated endpoint checks:"
  log "      export TEST_TOKEN=<jwt>  TEST_ACCOUNT_ID=<uuid>"
else
  STATS_RESPONSE=$(curl -s --max-time 10 \
    -H "Authorization: Bearer $TEST_TOKEN" \
    "$API_BASE/api/accounts/$TEST_ACCOUNT_ID/analysis/stats" || echo "CURL_ERROR")

  if echo "$STATS_RESPONSE" | jq -e '.total_posts' > /dev/null 2>&1; then
    ok "Stats endpoint returned data without AI"
  else
    fail "Stats endpoint failed or returned unexpected JSON: $STATS_RESPONSE"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Trigger analysis start — backend should enqueue, not crash
#
# With vLLM down, classify_captions will fall back to Groq automatically
# (router.py fallback chain: groq,openrouter,vllm per AI_FALLBACK_CHAIN).
# The task must NOT fail immediately — it should proceed via fallback.
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "==> Step 3: Analysis start — should enqueue and use fallback"

if [ -z "${TEST_TOKEN:-}" ] || [ -z "${TEST_ACCOUNT_ID:-}" ]; then
  log "SKIP: TEST_TOKEN or TEST_ACCOUNT_ID not set."
else
  START_RESPONSE=$(curl -s --max-time 10 \
    -X POST \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/accounts/$TEST_ACCOUNT_ID/analysis/start" || echo "CURL_ERROR")

  HTTP_START=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/accounts/$TEST_ACCOUNT_ID/analysis/start" 2>/dev/null || echo "000")

  # 200 = started, 409 = already running (both acceptable here)
  if [ "$HTTP_START" = "200" ] || [ "$HTTP_START" = "409" ]; then
    ok "Analysis start returned HTTP $HTTP_START (enqueued or already running)"
  else
    fail "Analysis start returned unexpected HTTP $HTTP_START: $START_RESPONSE"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Check backend logs for fallback WARNING
#
# After triggering analysis, backend logs should contain:
#   WARNING ... vllm ... fallback ... groq
# This confirms the fallback chain activated.
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "==> Step 4: Check journal for fallback warning (informational)"
log "    Run manually to verify fallback chain activated in logs:"
log "    journalctl -u contentflow-celery-analysis --since '5 minutes ago' | grep -i fallback"
log "    journalctl -u contentflow-celery-analysis --since '5 minutes ago' | grep -i 'WARNING'"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Unauthenticated content-ideas — should return 401, not 500
# (verifies error handling path when AI not called at all for unauthed requests)
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "==> Step 5: Unauthenticated content-ideas returns 401 not 500"
HTTP_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"count":1}' \
  "$API_BASE/api/accounts/00000000-0000-0000-0000-000000000000/analysis/content-ideas" || echo "000")

if [ "$HTTP_UNAUTH" = "401" ] || [ "$HTTP_UNAUTH" = "403" ]; then
  ok "Unauthenticated request correctly rejected (HTTP $HTTP_UNAUTH)"
else
  fail "Expected 401/403 for unauthed request, got HTTP $HTTP_UNAUTH"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
log ""
log "============================================="
log "Smoke test complete: PASS=$PASS  FAIL=$FAIL"
log "============================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
