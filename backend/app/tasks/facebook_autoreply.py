"""V6 — Celery: process Facebook Page webhook comment events and send replies.

Flow:
    process_facebook_event(payload)
        └── _process(payload)
                └── per entry → _handle_entry(db, entry)
                        └── per comment change → _handle_match(db, account, ...)

Safety guarantees (mirrors instagram_autoreply.py architecture):
  - Loop protection: never reply to our own Page's comment (from.id == page_id).
  - Idempotency: UNIQUE(account_id, ig_object_id) + ON CONFLICT DO NOTHING.
    (ig_object_id column is reused for comment_id — column name is legacy IG but
     the constraint is platform-agnostic per DB agent decision.)
  - Rate limit: 100 replies/hour per Page account (Redis counter).
  - platform='facebook' and reply_mode written to autoreply_logs.
"""
from __future__ import annotations

import asyncio
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.tasks.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FB_PAGE_HOURLY_LIMIT = 100


def _session_factory():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@celery_app.task(
    name="contentflow.process_facebook_event",
    max_retries=2,
    default_retry_delay=30,
)
def process_facebook_event(payload: dict):
    """Entry point: called by the Facebook webhook router.

    Runs in the default queue. Uses asyncio.run() per V5/V4 pattern.
    """
    asyncio.run(_process(payload))


async def _process(payload: dict) -> None:
    if not isinstance(payload, dict) or payload.get("object") != "page":
        logger.debug("fb_autoreply: non-page payload object=%r — skipping", payload.get("object"))
        return

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            for entry in payload.get("entry", []) or []:
                await _handle_entry(db, entry)
    finally:
        await engine.dispose()


async def _handle_entry(db: AsyncSession, entry: dict) -> None:
    from app.models.account import Account

    page_id = str(entry.get("id", ""))
    if not page_id:
        return

    # Look up our account by FB page ID
    result = await db.execute(
        select(Account).where(
            Account.platform == "facebook",
            Account.fb_page_id == page_id,
            Account.is_active == True,  # noqa: E712
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        logger.info("fb_autoreply: no account for page_id=%s — skipping", page_id)
        return

    # ── Feed changes: look for comment/add events ─────────────────────────────
    for change in entry.get("changes", []) or []:
        if change.get("field") != "feed":
            continue
        value = change.get("value", {}) or {}
        item = value.get("item", "")
        verb = value.get("verb", "")

        if item != "comment" or verb != "add":
            continue

        comment_id = str(value.get("comment_id", ""))
        from_info = value.get("from", {}) or {}
        from_id = str(from_info.get("id", ""))
        text = value.get("message", "")

        if not comment_id:
            continue

        # ── Loop protection: skip if our own Page commented ───────────────────
        if from_id and from_id == account.fb_page_id:
            await _log(
                db, account.id, None, "comment", comment_id, from_id, text,
                None, None, "skipped_self", platform="facebook",
            )
            continue

        await _handle_match(db, account, "comment", text, from_id, comment_id)


def _matches(rule, text: str) -> tuple[bool, str | None]:
    """Return (matched, matched_keyword). Mirrors instagram_autoreply._matches."""
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


async def _handle_match(
    db: AsyncSession,
    account,
    target: str,
    text: str,
    sender_id: str,
    object_id: str,
) -> None:
    from app.models.autoreply import AutoReplyRule

    if not object_id:
        return

    # ── Idempotency: claim this object ────────────────────────────────────────
    proceed = await _claim_object(db, account.id, target, object_id, sender_id, text)
    if not proceed:
        return  # already replied

    # ── Find first matching active rule for Facebook comments ─────────────────
    result = await db.execute(
        select(AutoReplyRule)
        .where(
            AutoReplyRule.account_id == account.id,
            AutoReplyRule.platform == "facebook",
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
        await _finalize(
            db, account.id, object_id,
            rule_id=None, matched_keyword=None,
            reply_text=None, status="skipped_no_match",
            platform="facebook", reply_mode=None,
        )
        return

    # ── Rate limit: 100 replies/hour per FB Page account ─────────────────────
    if not await _rate_ok(account.id):
        await _finalize(
            db, account.id, object_id,
            rule_id=matched_rule.id, matched_keyword=matched_kw,
            reply_text=None, status="skipped_rate_limit",
            platform="facebook", reply_mode=matched_rule.reply_mode,
        )
        return

    # ── Decrypt page token ────────────────────────────────────────────────────
    from app.services.encryption import decrypt_credentials
    from app.services.facebook_graph import reply_to_comment, GraphAPIError

    try:
        creds = decrypt_credentials(account.credentials)
        token = creds.get("access_token", "")
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "fb_autoreply: credential decrypt failed account_id=%s: %s", account.id, exc
        )
        await _finalize(
            db, account.id, object_id,
            rule_id=matched_rule.id, matched_keyword=matched_kw,
            reply_text=None, status="failed",
            error_detail=f"Credential error: {str(exc)[:500]}",
            platform="facebook", reply_mode=matched_rule.reply_mode,
        )
        return

    reply_mode = matched_rule.reply_mode or "template"

    # ── Determine reply text ──────────────────────────────────────────────────
    reply_text: str | None = None

    if reply_mode == "ai":
        from app.tasks.ai_reply import generate_ai_reply  # noqa: PLC0415

        reply_text = await generate_ai_reply(
            account=account,
            rule=matched_rule,
            comment_text=text,
            post_context=None,  # FB feed webhook doesn't include post content
        )
        if reply_text is None:
            # AI decided to skip (spam/off-topic/error)
            await _finalize(
                db, account.id, object_id,
                rule_id=matched_rule.id, matched_keyword=matched_kw,
                reply_text=None, status="skipped_ai",
                platform="facebook", reply_mode="ai",
            )
            return
    else:
        # template mode
        reply_text = matched_rule.reply_text

    # ── Send reply ────────────────────────────────────────────────────────────
    try:
        await reply_to_comment(token, object_id, reply_text)
        await _finalize(
            db, account.id, object_id,
            rule_id=matched_rule.id, matched_keyword=matched_kw,
            reply_text=reply_text, status="sent",
            platform="facebook", reply_mode=reply_mode,
        )

    except GraphAPIError as exc:
        await _finalize(
            db, account.id, object_id,
            rule_id=matched_rule.id, matched_keyword=matched_kw,
            reply_text=reply_text, status="failed",
            error_detail=exc.detail[:1000],
            platform="facebook", reply_mode=reply_mode,
        )
        # Retry only on 5xx / unknown — 4xx is permanent
        if exc.status_code is None or exc.status_code >= 500:
            raise process_facebook_event.retry(countdown=30)  # noqa: RET503

    except Exception as exc:  # noqa: BLE001
        await _finalize(
            db, account.id, object_id,
            rule_id=matched_rule.id, matched_keyword=matched_kw,
            reply_text=reply_text, status="failed",
            error_detail=str(exc)[:1000],
            platform="facebook", reply_mode=reply_mode,
        )


# ─── Persistence helpers ─────────────────────────────────────────────────────

async def _claim_object(
    db: AsyncSession,
    account_id,
    event_type: str,
    object_id: str,
    sender_id: str,
    text: str,
) -> bool:
    """Claim an object for processing. Returns True if we should proceed.

    Uses same uq_autoreply_account_object constraint as IG (account_id, ig_object_id).
    Fresh insert → proceed.  Conflict → proceed only if status is not 'sent'.
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
            platform="facebook",
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

    # Already exists — allow retry unless already 'sent'
    existing = await db.execute(
        select(AutoReplyLog.status).where(
            AutoReplyLog.account_id == account_id,
            AutoReplyLog.ig_object_id == object_id,
        )
    )
    return existing.scalar_one_or_none() != "sent"


async def _finalize(
    db: AsyncSession,
    account_id,
    object_id: str,
    *,
    rule_id,
    matched_keyword,
    reply_text,
    status: str,
    platform: str = "facebook",
    reply_mode: str | None = None,
    error_detail: str | None = None,
) -> None:
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
    log.platform = platform
    log.reply_mode = reply_mode
    log.error_detail = error_detail
    db.add(log)
    await db.commit()


async def _log(
    db: AsyncSession,
    account_id,
    rule_id,
    event_type: str,
    object_id: str,
    sender_id: str,
    text: str,
    matched_keyword,
    reply_text,
    status: str,
    platform: str = "facebook",
    error_detail: str | None = None,
) -> None:
    """Direct best-effort log (for skipped_self before claiming)."""
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
            platform=platform,
            error_detail=error_detail,
            created_at=datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(constraint="uq_autoreply_account_object")
    )
    await db.execute(stmt)
    await db.commit()


async def _rate_ok(account_id) -> bool:
    """Per-account hourly FB reply cap using a Redis counter.

    Cap: FB_PAGE_HOURLY_LIMIT (100) per account per hour.
    Key: fb_reply_count:{account_id}:{YYYYMMDDHH}

    Uses a short-lived connection instead of app.redis_client's cached
    global client — see the identical fix (and full explanation) in
    instagram_autoreply.py._rate_ok / analysis_tasks.py._acquire_lock.
    """
    import redis.asyncio as aioredis

    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H")
        key = f"fb_reply_count:{account_id}:{bucket}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
        return count <= FB_PAGE_HOURLY_LIMIT
    finally:
        await redis.connection_pool.disconnect()
        await redis.aclose()


# ─── Beat tasks (registered in celery_app.py) ────────────────────────────────

@celery_app.task(name="contentflow.fb_token_health_check")
def fb_token_health_check():
    """Daily 03:45 UTC — check FB Page tokens, mark expired accounts."""
    asyncio.run(_fb_token_health_check_async())


async def _fb_token_health_check_async() -> None:
    from app.models.account import Account
    from app.services.encryption import decrypt_credentials
    from app.services.facebook_graph import check_token, GraphAPIError

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            result = await db.execute(
                select(Account).where(
                    Account.platform == "facebook",
                    Account.is_active == True,  # noqa: E712
                    Account.fb_page_id.isnot(None),
                )
            )
            accounts = list(result.scalars().all())

        logger.info("fb_token_health: checking %d FB accounts", len(accounts))

        for account in accounts:
            try:
                creds = decrypt_credentials(account.credentials)
                token = creds.get("access_token", "")
                if not token:
                    continue

                is_valid = await check_token(token)
                new_status = "active" if is_valid else "expired"

                if new_status != account.token_status:
                    async with factory() as db:
                        result = await db.execute(
                            select(Account).where(Account.id == account.id)
                        )
                        acc = result.scalar_one_or_none()
                        if acc:
                            acc.token_status = new_status
                            db.add(acc)
                            await db.commit()
                    logger.info(
                        "fb_token_health: account_id=%s token_status=%s→%s",
                        account.id, account.token_status, new_status,
                    )

            except GraphAPIError as exc:
                # Non-190 Graph error — log and continue
                logger.warning(
                    "fb_token_health: GraphAPIError account_id=%s code=%s: %s",
                    account.id, exc.fb_error_code, exc.detail,
                )
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "fb_token_health: error account_id=%s: %s", account.id, exc
                )
    finally:
        await engine.dispose()


@celery_app.task(name="contentflow.cleanup_old_image_jobs")
def cleanup_old_image_jobs():
    """Daily 04:30 UTC — delete image files and image_jobs rows older than 30 days
    that belong to discarded AI post drafts.
    """
    asyncio.run(_cleanup_old_image_jobs_async())


async def _cleanup_old_image_jobs_async() -> None:
    import os
    from datetime import timedelta
    from sqlalchemy import delete
    from app.models.ai_posts import ImageJob, AiPostDraft

    engine, factory = _session_factory()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    try:
        async with factory() as db:
            # Find image_jobs older than 30 days whose draft is discarded
            result = await db.execute(
                select(ImageJob)
                .join(AiPostDraft, ImageJob.draft_id == AiPostDraft.id, isouter=True)
                .where(
                    ImageJob.created_at < cutoff,
                    AiPostDraft.status == "discarded",
                )
            )
            jobs = list(result.scalars().all())

        logger.info("cleanup_image_jobs: found %d eligible jobs to clean up", len(jobs))

        deleted_files = 0
        deleted_rows = 0

        for job in jobs:
            # Delete file from disk
            if job.file_path:
                try:
                    if os.path.exists(job.file_path):
                        os.remove(job.file_path)
                        deleted_files += 1
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "cleanup_image_jobs: could not delete file %s: %s",
                        job.file_path, exc,
                    )

            # Delete DB row
            try:
                async with factory() as db:
                    await db.execute(
                        delete(ImageJob).where(ImageJob.id == job.id)
                    )
                    await db.commit()
                    deleted_rows += 1
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "cleanup_image_jobs: DB delete failed job_id=%s: %s", job.id, exc
                )

        logger.info(
            "cleanup_image_jobs: deleted %d files, %d DB rows",
            deleted_files, deleted_rows,
        )

    finally:
        await engine.dispose()
