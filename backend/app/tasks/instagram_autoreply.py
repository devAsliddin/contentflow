"""V4 — Celery: process Instagram webhook events and send keyword-based replies.

Flow (see information/tasks/v4/05-celery-autoreply-logic.md):
  process_instagram_event(payload)  →  per entry  →  handle_match(...)

Safety guarantees:
  - Loop protection: never reply to our own account's events.
  - Idempotency: UNIQUE(account_id, ig_object_id) + ON CONFLICT DO NOTHING.
  - DM rate limit: 200/hour/account (Redis counter).
  - DM 24-hour window: skip standard replies older than 24h.
"""
import asyncio
import uuid
import logging
import time
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.tasks.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

DM_HOURLY_LIMIT = 200
DM_WINDOW_SECONDS = 24 * 60 * 60


def _session_factory():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@celery_app.task(name="contentflow.process_instagram_event", max_retries=2, default_retry_delay=30)
def process_instagram_event(payload: dict):
    asyncio.run(_process(payload))


async def _process(payload: dict):
    if not isinstance(payload, dict) or payload.get("object") != "instagram":
        return

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            for entry in payload.get("entry", []) or []:
                await _handle_entry(db, entry)
    finally:
        await engine.dispose()


async def _handle_entry(db: AsyncSession, entry: dict):
    from app.models.account import Account

    recipient_ig_id = str(entry.get("id", ""))
    if not recipient_ig_id:
        return

    result = await db.execute(
        select(Account).where(
            Account.ig_user_id == recipient_ig_id,
            Account.platform == "instagram",
            Account.is_active == True,  # noqa: E712
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        logger.info("No account for IG id %s — skipping", recipient_ig_id)
        return

    # ── DM events ───────────────────────────────────────────────────────────
    for msg_event in entry.get("messaging", []) or []:
        sender_id = str(msg_event.get("sender", {}).get("id", ""))
        message = msg_event.get("message", {}) or {}
        object_id = message.get("mid", "")
        text = message.get("text", "")

        if message.get("is_echo"):
            continue  # our own outgoing message echoed back
        if sender_id == recipient_ig_id:
            await _log(db, account.id, None, "dm", object_id, sender_id, text,
                       None, None, "skipped_self")
            continue

        # 24-hour window check
        ts_ms = msg_event.get("timestamp")
        if ts_ms and (time.time() - (int(ts_ms) / 1000)) > DM_WINDOW_SECONDS:
            await _log(db, account.id, None, "dm", object_id, sender_id, text,
                       None, None, "skipped_24h")
            continue

        await _handle_match(db, account, "dm", text, sender_id, object_id)

    # ── Comment events ──────────────────────────────────────────────────────
    for change in entry.get("changes", []) or []:
        if change.get("field") != "comments":
            continue
        value = change.get("value", {}) or {}
        sender_id = str(value.get("from", {}).get("id", ""))
        object_id = value.get("id", "")
        text = value.get("text", "")

        if sender_id == recipient_ig_id:
            await _log(db, account.id, None, "comment", object_id, sender_id, text,
                       None, None, "skipped_self")
            continue

        await _handle_match(db, account, "comment", text, sender_id, object_id)


def _matches(rule, text: str) -> tuple[bool, str | None]:
    """Return (matched, matched_keyword)."""
    if rule.match_type == "any":
        return True, None

    haystack = text if rule.case_sensitive else text.lower()
    for kw in rule.keywords or []:
        needle = kw if rule.case_sensitive else kw.lower()
        if rule.match_type == "contains" and needle in haystack:
            return True, kw
        if rule.match_type == "exact" and haystack == needle:
            return True, kw
        if rule.match_type == "starts_with" and haystack.startswith(needle):
            return True, kw
    return False, None


async def _handle_match(db, account, target, text, sender_id, object_id):
    from app.models.autoreply import AutoReplyRule

    if not object_id:
        return

    # ── Idempotency: claim this object first (placeholder row) ────────────────
    # Blocks only when a reply was already SENT — so a Celery retry of a failed
    # send can still proceed, while a duplicate webhook after success is skipped.
    proceed = await _claim_object(db, account.id, target, object_id, sender_id, text)
    if not proceed:
        return  # already replied

    # ── Find first matching active rule (priority DESC) ───────────────────────
    result = await db.execute(
        select(AutoReplyRule)
        .where(
            AutoReplyRule.account_id == account.id,
            AutoReplyRule.target == target,
            AutoReplyRule.is_active == True,  # noqa: E712
        )
        .order_by(AutoReplyRule.priority.desc(), AutoReplyRule.created_at.asc())
    )
    rules = result.scalars().all()

    matched_rule = None
    matched_kw = None
    for rule in rules:
        ok, kw = _matches(rule, text or "")
        if ok:
            matched_rule, matched_kw = rule, kw
            break

    if not matched_rule:
        await _finalize(db, account.id, object_id, rule_id=None, matched_keyword=None,
                        reply_text=None, status="skipped_no_match")
        return

    # ── Rate limit (DM only) ──────────────────────────────────────────────────
    if target == "dm" and not await _rate_ok(account.id):
        await _finalize(db, account.id, object_id, rule_id=matched_rule.id,
                        matched_keyword=matched_kw, reply_text=None,
                        status="skipped_rate_limit")
        return

    # ── Decrypt token + send reply ────────────────────────────────────────────
    from app.services.encryption import decrypt_credentials
    from app.services import instagram_graph as ig

    try:
        creds = decrypt_credentials(account.credentials)
        token = creds.get("access_token", "")
        reply = matched_rule.reply_text

        if target == "dm":
            await ig.send_dm(token, sender_id, reply)
        else:
            action = matched_rule.comment_action or "reply_public"
            if action in ("reply_public", "both"):
                await ig.reply_to_comment(token, object_id, reply)
            if action in ("reply_private", "both"):
                await ig.send_private_reply(token, object_id, reply)

        await _finalize(db, account.id, object_id, rule_id=matched_rule.id,
                        matched_keyword=matched_kw, reply_text=reply, status="sent")

    except ig.GraphAPIError as exc:
        await _finalize(db, account.id, object_id, rule_id=matched_rule.id,
                        matched_keyword=matched_kw, reply_text=matched_rule.reply_text,
                        status="failed", error_detail=exc.detail[:1000])
        # Retry only on 5xx / unknown — 4xx is permanent.
        if exc.status_code is None or exc.status_code >= 500:
            raise process_instagram_event.retry(countdown=30)  # noqa: RET503
    except Exception as exc:  # noqa: BLE001
        await _finalize(db, account.id, object_id, rule_id=matched_rule.id,
                        matched_keyword=matched_kw, reply_text=matched_rule.reply_text,
                        status="failed", error_detail=str(exc)[:1000])


# ─── Persistence helpers ────────────────────────────────────────────────────────

async def _claim_object(db, account_id, event_type, object_id, sender_id, text) -> bool:
    """Claim an object for processing. Returns True if we should proceed.

    Fresh insert → proceed. On conflict, proceed only if the existing row is not
    already 'sent' (lets a retry re-attempt a failed send without re-sending a
    successful one).
    """
    from app.models.autoreply import AutoReplyLog

    stmt = (
        pg_insert(AutoReplyLog)
        .values(
            id=uuid.uuid4(),
            account_id=account_id,
            event_type=event_type,
            ig_object_id=object_id,
            sender_ig_id=sender_id,
            incoming_text=text,
            status="skipped_no_match",  # provisional; updated by _finalize
            created_at=datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(constraint="uq_autoreply_account_object")
        .returning(AutoReplyLog.id)
    )
    result = await db.execute(stmt)
    await db.commit()
    if result.scalar_one_or_none() is not None:
        return True  # fresh claim

    existing = await db.execute(
        select(AutoReplyLog.status).where(
            AutoReplyLog.account_id == account_id,
            AutoReplyLog.ig_object_id == object_id,
        )
    )
    return existing.scalar_one_or_none() != "sent"


async def _finalize(db, account_id, object_id, *, rule_id, matched_keyword,
                    reply_text, status, error_detail=None):
    from app.models.autoreply import AutoReplyLog

    result = await db.execute(
        select(AutoReplyLog).where(
            AutoReplyLog.account_id == account_id,
            AutoReplyLog.ig_object_id == object_id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        return
    log.rule_id = rule_id
    log.matched_keyword = matched_keyword
    log.reply_text = reply_text
    log.status = status
    log.error_detail = error_detail
    db.add(log)
    await db.commit()


async def _log(db, account_id, rule_id, event_type, object_id, sender_id, text,
               matched_keyword, reply_text, status, error_detail=None):
    """Direct best-effort log (for skipped_self / skipped_24h before claiming)."""
    from app.models.autoreply import AutoReplyLog

    if not object_id:
        return
    stmt = (
        pg_insert(AutoReplyLog)
        .values(
            id=uuid.uuid4(),
            account_id=account_id,
            rule_id=rule_id,
            event_type=event_type,
            ig_object_id=object_id,
            sender_ig_id=sender_id,
            incoming_text=text,
            matched_keyword=matched_keyword,
            reply_text=reply_text,
            status=status,
            error_detail=error_detail,
            created_at=datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(constraint="uq_autoreply_account_object")
    )
    await db.execute(stmt)
    await db.commit()


async def _rate_ok(account_id) -> bool:
    """Per-account hourly DM cap using a Redis counter."""
    from app.redis_client import get_redis

    redis = get_redis()
    bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    key = f"ig_dm_count:{account_id}:{bucket}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 3600)
    return count <= DM_HOURLY_LIMIT
