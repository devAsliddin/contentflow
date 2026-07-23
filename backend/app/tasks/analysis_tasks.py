"""V5 — Celery tasks: Instagram AI analysis pipeline + beat tasks.

Task chain (all in "analysis" queue):
    run_initial_analysis
        └── fetch_media_and_metrics  (progress 20%)
        └── compute_stats            (progress 40%)
        └── classify_captions        (progress 60%)
        └── generate_account_profile (progress 80%)
        └── generate_recommendations (progress 100% / done)

Beat tasks (registered in celery_app.py):
    daily_account_snapshot  — 03:30 UTC every day
    weekly_refresh          — 04:00 UTC every Monday

Async pattern: identical to instagram_autoreply.py — asyncio.run() inside
each sync Celery task, with a dedicated engine+session created and disposed
per invocation.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from collections import Counter
from datetime import datetime, date, timezone, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.tasks.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_HASHTAG_RE = re.compile(r"#(\w+)")

# ---------------------------------------------------------------------------
# Session factory (same pattern as instagram_autoreply.py)
# ---------------------------------------------------------------------------

def _session_factory():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Redis lock helpers
# ---------------------------------------------------------------------------

LOCK_TTL = 1800  # 30 minutes


async def _acquire_lock(account_id: str) -> bool:
    """SET NX EX — returns True if lock acquired.

    Uses a short-lived connection instead of app.redis_client's cached
    global client: that client is bound to whichever asyncio event loop
    first created it, but each Celery task here runs in its own
    asyncio.run() loop, so a worker process reusing the global client
    across tasks raises "Future attached to a different loop".

    aclose() alone does not fully release the pooled connection — a
    later task in the same worker process would still intermittently hit
    the same "different loop" error (a leftover connection's finalizer
    referencing the closed loop). Explicitly disconnecting the pool
    avoids that; verified with 6 back-to-back asyncio.run() calls in the
    same process before shipping this.
    """
    import redis.asyncio as aioredis
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        key = f"analysis_lock:{account_id}"
        result = await redis.set(key, "1", nx=True, ex=LOCK_TTL)
        return result is True
    finally:
        await redis.connection_pool.disconnect()
        await redis.aclose()


async def _release_lock(account_id: str) -> None:
    import redis.asyncio as aioredis
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.delete(f"analysis_lock:{account_id}")
    finally:
        await redis.connection_pool.disconnect()
        await redis.aclose()


# ---------------------------------------------------------------------------
# Progress helper
# ---------------------------------------------------------------------------

async def _update_job(
    db: AsyncSession,
    job_id: str | None,
    *,
    status: str,
    progress_pct: int,
    error_message: str | None = None,
    finished: bool = False,
) -> None:
    from app.models.analysis import AnalysisJob

    if not job_id:
        return

    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        return

    result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == jid))
    job = result.scalar_one_or_none()
    if not job:
        return

    job.status = status
    job.progress_pct = progress_pct
    if error_message is not None:
        job.error_message = error_message
    if status == "fetching" and job.started_at is None:
        job.started_at = datetime.now(timezone.utc)
    if finished:
        job.finished_at = datetime.now(timezone.utc)
    db.add(job)
    await db.commit()


# ---------------------------------------------------------------------------
# Monday of current week (week_start for recommendations)
# ---------------------------------------------------------------------------

def _current_week_monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


# ---------------------------------------------------------------------------
# 1. run_initial_analysis — orchestrator task
# ---------------------------------------------------------------------------

@celery_app.task(
    name="contentflow.run_initial_analysis",
    queue="analysis",
    bind=True,
    max_retries=4,
    default_retry_delay=6 * 3600,
)
def run_initial_analysis(self, account_id: str, job_id: str | None = None):
    """Full analysis pipeline for one Instagram account.

    Redis lock analysis_lock:{account_id} (SET NX EX 1800) prevents
    concurrent runs. Steps: fetch(20) → compute(40) → classify(60)
    → profile(80) → recommendations → done(100).
    """
    asyncio.run(_run_initial_analysis_async(self, account_id, job_id))


async def _run_initial_analysis_async(task, account_id: str, job_id: str | None):
    # ── Redis lock ────────────────────────────────────────────────────────────
    acquired = await _acquire_lock(account_id)
    if not acquired:
        logger.info(
            "analysis.run: lock already held for account_id=%s — skipping", account_id
        )
        return

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            await _update_job(db, job_id, status="fetching", progress_pct=0)

        # ── Step 1: fetch media + metrics ────────────────────────────────────
        try:
            async with factory() as db:
                token, ig_user_id = await _get_token(db, account_id)
                insights_degraded = await _fetch_media_and_metrics(
                    db, account_id, token, ig_user_id
                )
                await _update_job(
                    db,
                    job_id,
                    status="fetching",
                    progress_pct=20,
                    error_message="Insights scope not available — using public metrics" if insights_degraded else None,
                )
        except _TokenExpiredCelery:
            async with factory() as db:
                await _update_job(
                    db, job_id,
                    status="failed", progress_pct=0,
                    error_message="token expired, reconnect required",
                    finished=True,
                )
            return
        except Exception as exc:  # noqa: BLE001
            logger.error("analysis.fetch failed account_id=%s: %s", account_id, exc)
            async with factory() as db:
                await _update_job(
                    db, job_id,
                    status="failed", progress_pct=20,
                    error_message=str(exc)[:500],
                    finished=True,
                )
            raise _maybe_retry(task, exc)

        # ── Step 2: compute stats (mark progress only) ───────────────────────
        async with factory() as db:
            await _update_job(db, job_id, status="computing", progress_pct=40)

        # ── Step 3: classify captions ────────────────────────────────────────
        try:
            async with factory() as db:
                await _classify_captions(db, account_id)
                await _update_job(db, job_id, status="classifying", progress_pct=60)
        except _AllProviders429 as exc:
            async with factory() as db:
                await _update_job(
                    db, job_id,
                    status="queued", progress_pct=60,
                    error_message="All AI providers rate-limited — will retry in 6 hours",
                )
            raise task.retry(countdown=6 * 3600, max_retries=4) from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("analysis.classify failed account_id=%s: %s", account_id, exc)
            # Non-fatal — continue with remaining steps

        # ── Step 4: generate account profile ────────────────────────────────
        try:
            async with factory() as db:
                await _generate_account_profile(db, account_id)
                await _update_job(db, job_id, status="profiling", progress_pct=80)
        except _AllProviders429 as exc:
            async with factory() as db:
                await _update_job(
                    db, job_id,
                    status="queued", progress_pct=80,
                    error_message="All AI providers rate-limited — will retry in 6 hours",
                )
            raise task.retry(countdown=6 * 3600, max_retries=4) from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("analysis.profile failed account_id=%s: %s", account_id, exc)

        # ── Step 5: generate recommendations ────────────────────────────────
        try:
            async with factory() as db:
                await _generate_recommendations(db, account_id)
        except _AllProviders429 as exc:
            async with factory() as db:
                await _update_job(
                    db, job_id,
                    status="queued", progress_pct=90,
                    error_message="All AI providers rate-limited — will retry in 6 hours",
                )
            raise task.retry(countdown=6 * 3600, max_retries=4) from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("analysis.recommendations failed account_id=%s: %s", account_id, exc)

        # ── Done ────────────────────────────────────────────────────────────
        async with factory() as db:
            await _update_job(
                db, job_id,
                status="done", progress_pct=100,
                finished=True,
            )
        logger.info("analysis.run: DONE account_id=%s job_id=%s", account_id, job_id)

    except Exception:
        # Re-raise Celery retries transparently
        raise
    finally:
        await _release_lock(account_id)
        await engine.dispose()


# ---------------------------------------------------------------------------
# Internal sentinel exceptions
# ---------------------------------------------------------------------------

class _TokenExpiredCelery(Exception):
    pass


class _AllProviders429(Exception):
    pass


def _maybe_retry(task, exc: Exception) -> Exception:
    """If exc looks like all-providers-429, return a Celery Retry; otherwise return exc."""
    if isinstance(exc, _AllProviders429):
        return task.retry(countdown=6 * 3600, max_retries=4)
    return exc


# ---------------------------------------------------------------------------
# Token fetch helper
# ---------------------------------------------------------------------------

async def _get_token(db: AsyncSession, account_id: str) -> tuple[str, str]:
    from app.models.account import Account
    from app.services.encryption import decrypt_credentials
    from app.services.instagram_insights import TokenExpiredError

    aid = uuid.UUID(account_id)
    result = await db.execute(
        select(Account).where(
            Account.id == aid,
            Account.platform == "instagram",
            Account.is_active == True,  # noqa: E712
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise _TokenExpiredCelery(f"Account {account_id} not found or inactive")

    creds = decrypt_credentials(account.credentials)
    token = creds.get("access_token", "")
    ig_user_id = creds.get("ig_user_id") or account.ig_user_id or ""
    if not token:
        raise _TokenExpiredCelery("No access_token in credentials")
    return token, ig_user_id


# ---------------------------------------------------------------------------
# Step 1: fetch media + metrics + account snapshot
# ---------------------------------------------------------------------------

async def _fetch_media_and_metrics(
    db: AsyncSession,
    account_id: str,
    token: str,
    ig_user_id: str,
) -> bool:
    """Fetch media list, per-post insights, account snapshot. Returns True if insights
    scope was degraded (403 returned but we continued with public metrics)."""
    from app.models.analysis import (
        MediaItem, MediaMetric, AccountMetricsSnapshot,
    )
    from app.services.instagram_insights import (
        fetch_media_list,
        fetch_media_insights,
        fetch_account_insights,
        TokenExpiredError,
    )

    aid = uuid.UUID(account_id)
    insights_degraded = False

    # ── Media list ───────────────────────────────────────────────────────────
    try:
        media_list = await fetch_media_list(token, settings.analysis_media_limit)
    except TokenExpiredError as exc:
        raise _TokenExpiredCelery(str(exc)) from exc

    now = datetime.now(timezone.utc)

    for raw in media_list:
        ig_media_id = str(raw.get("id", ""))
        if not ig_media_id:
            continue

        caption: str | None = raw.get("caption")
        media_type_raw: str = (raw.get("media_type") or "IMAGE").upper()
        # Normalise to enum values
        valid_types = {"IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS"}
        media_type = media_type_raw if media_type_raw in valid_types else "IMAGE"

        # REELS: media_product_type == "REELS" takes precedence
        if raw.get("media_product_type", "").upper() == "REELS":
            media_type = "REELS"

        permalink: str | None = raw.get("permalink")
        timestamp_str: str | None = raw.get("timestamp")
        try:
            posted_at = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00")) if timestamp_str else now
        except (ValueError, AttributeError):
            posted_at = now

        # Parse hashtags from caption
        hashtags: list[str] = _HASHTAG_RE.findall(caption or "")

        # Upsert media_item by ig_media_id
        stmt = (
            pg_insert(MediaItem)
            .values(
                id=uuid.uuid4(),
                account_id=aid,
                ig_media_id=ig_media_id,
                media_type=media_type,
                caption=caption,
                hashtags=hashtags,
                permalink=permalink,
                posted_at=posted_at,
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=["ig_media_id"],
                set_={
                    "caption": caption,
                    "hashtags": hashtags,
                    "permalink": permalink,
                    "posted_at": posted_at,
                    "media_type": media_type,
                    "updated_at": now,
                },
            )
            .returning(MediaItem.id)
        )
        result = await db.execute(stmt)
        media_item_id: uuid.UUID = result.scalar_one()
        await db.commit()

        # ── Per-media insights ───────────────────────────────────────────────
        insights: dict[str, Any] | None = None
        try:
            insights = await fetch_media_insights(token, ig_media_id, media_type)
        except TokenExpiredError as exc:
            raise _TokenExpiredCelery(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("ig_insights: media %s insights failed: %s", ig_media_id, exc)

        if insights is None:
            # Graceful degradation — use public like/comment counts from media list
            insights_degraded = True
            insights = {
                "likes": raw.get("like_count"),
                "comments": raw.get("comments_count"),
            }

        # Build metric row
        likes = _int(insights.get("likes") or insights.get("like_count"))
        comments = _int(insights.get("comments") or insights.get("comments_count"))
        saves = _int(insights.get("saved"))
        shares = _int(insights.get("shares"))
        reach = _int(insights.get("reach"))
        impressions = _int(insights.get("views") or insights.get("impressions"))
        plays = _int(insights.get("plays"))
        avg_watch_time_ms = _int(insights.get("ig_reels_avg_watch_time"))

        # Compute ER
        engagement = (likes or 0) + (comments or 0) + (saves or 0) + (shares or 0)
        er: float | None = None
        if reach and reach > 0:
            er = engagement / reach
        # else: will be computed from followers later; store None for now

        await db.execute(
            pg_insert(MediaMetric)
            .values(
                id=uuid.uuid4(),
                media_item_id=media_item_id,
                like_count=likes,
                comments_count=comments,
                saved_count=saves,
                shares_count=shares,
                reach=reach,
                impressions=impressions,
                plays=plays,
                avg_watch_time_ms=avg_watch_time_ms,
                engagement_rate=er,
                fetched_at=now,
            )
        )
        await db.commit()

    # ── Account-level insights + snapshot ───────────────────────────────────
    acc_insights: dict[str, Any] | None = None
    if ig_user_id:
        try:
            acc_insights = await fetch_account_insights(token, ig_user_id)
        except TokenExpiredError as exc:
            raise _TokenExpiredCelery(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("ig_insights: account insights failed: %s", exc)
            insights_degraded = True

    if acc_insights:
        followers = _int(acc_insights.get("followers_count")) or 0
        following = _int(acc_insights.get("follows_count")) or 0
        media_count = _int(acc_insights.get("media_count")) or 0
        reach_28d = _int(acc_insights.get("reach"))
        impressions_28d = _int(acc_insights.get("views") or acc_insights.get("impressions"))
        profile_views_28d = _int(acc_insights.get("profile_views"))
        demographics = acc_insights.get("demographics")

        today = date.today()
        await db.execute(
            pg_insert(AccountMetricsSnapshot)
            .values(
                id=uuid.uuid4(),
                account_id=aid,
                snapshot_date=today,
                followers_count=followers,
                following_count=following,
                media_count=media_count,
                reach_28d=reach_28d,
                impressions_28d=impressions_28d,
                profile_views_28d=profile_views_28d,
                demographics=demographics,
                raw=acc_insights,
            )
            .on_conflict_do_update(
                constraint="uq_account_metrics_account_date",
                set_={
                    "followers_count": followers,
                    "following_count": following,
                    "media_count": media_count,
                    "reach_28d": reach_28d,
                    "impressions_28d": impressions_28d,
                    "profile_views_28d": profile_views_28d,
                    "demographics": demographics,
                    "raw": acc_insights,
                },
            )
        )
        await db.commit()

    return insights_degraded


# ---------------------------------------------------------------------------
# Step 3: classify captions
# ---------------------------------------------------------------------------

async def _classify_captions(db: AsyncSession, account_id: str) -> None:
    """Classify unclassified media captions in chunks of ANALYSIS_CLASSIFY_CHUNK_SIZE."""
    from app.models.analysis import MediaItem, MediaClassification
    from app.services.ai.json_utils import complete_json_validated, extract_json
    from app.schemas.analysis import CaptionClassification

    aid = uuid.UUID(account_id)
    chunk_size = settings.analysis_classify_chunk_size

    # Load media with captions that have no classification yet
    classified_sq = select(MediaClassification.media_item_id)
    result = await db.execute(
        select(MediaItem)
        .where(
            MediaItem.account_id == aid,
            MediaItem.caption.isnot(None),
            MediaItem.caption != "",
            ~MediaItem.id.in_(classified_sq),
        )
        .order_by(MediaItem.posted_at.desc())
    )
    unclassified: list[MediaItem] = list(result.scalars().all())

    if not unclassified:
        logger.info("analysis.classify: nothing to classify for account_id=%s", account_id)
        return

    logger.info(
        "analysis.classify: %d media items to classify (chunk_size=%d) account_id=%s",
        len(unclassified), chunk_size, account_id,
    )

    system = (
        "Sen Instagram caption klassifikatorisan. Har bir caption uchun JSON qaytar.\n"
        "Faqat JSON array qaytar, boshqa hech narsa yozma. Format:\n"
        '[{"index": 0, "topic": "...", '
        '"tone": "professional|friendly|humorous|inspirational|salesy|informative", '
        '"has_cta": true, "language": "uz|ru|en|mixed"}]\n'
        "Captionlar o'zbek, rus yoki ingliz tilida bo'lishi mumkin."
    )

    now = datetime.now(timezone.utc)

    for start in range(0, len(unclassified), chunk_size):
        chunk = unclassified[start: start + chunk_size]
        numbered_captions = "\n\n".join(
            f"[{i}] {item.caption}" for i, item in enumerate(chunk)
        )

        prompt = (
            f"Quyidagi {len(chunk)} ta Instagram caption'ni klassifikatsiya qil:\n\n"
            f"{numbered_captions}"
        )

        try:
            # Try with full Pydantic list validation via JSON extraction
            from pydantic import TypeAdapter
            ta = TypeAdapter(list[CaptionClassification])

            completion = await _complete_for_task_with_429_guard(
                "classification", system=system, prompt=prompt, max_tokens=1500, temperature=0.1
            )
            raw_json = extract_json(completion.text)
            classifications: list[CaptionClassification] = ta.validate_python(raw_json)
            model_used = completion.model

        except _AllProviders429:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "analysis.classify: chunk start=%d failed for account_id=%s: %s",
                start, account_id, exc,
            )
            continue

        # Upsert classifications
        for cls_item in classifications:
            if cls_item.index >= len(chunk):
                continue
            media_item = chunk[cls_item.index]
            await db.execute(
                pg_insert(MediaClassification)
                .values(
                    id=uuid.uuid4(),
                    media_item_id=media_item.id,
                    topic=cls_item.topic,
                    tone=cls_item.tone,
                    has_cta=cls_item.has_cta,
                    language=cls_item.language,
                    model_used=model_used,
                    created_at=now,
                )
                .on_conflict_do_update(
                    index_elements=["media_item_id"],
                    set_={
                        "topic": cls_item.topic,
                        "tone": cls_item.tone,
                        "has_cta": cls_item.has_cta,
                        "language": cls_item.language,
                        "model_used": model_used,
                    },
                )
            )
        await db.commit()

        logger.info(
            "analysis.classify: chunk start=%d → %d classified account_id=%s",
            start, len(classifications), account_id,
        )


# ---------------------------------------------------------------------------
# Step 4: generate account profile
# ---------------------------------------------------------------------------

async def _generate_account_profile(db: AsyncSession, account_id: str) -> None:
    """Generate AI account profile, store versioned row in account_profiles."""
    from app.models.analysis import (
        AccountProfile, MediaItem, MediaMetric, MediaClassification,
        AccountMetricsSnapshot,
    )
    from app.schemas.analysis import AccountProfileSchema, StatsSummary
    from app.services.analysis.stats import compute_stats

    aid = uuid.UUID(account_id)

    # Compute new version number
    ver_result = await db.execute(
        select(func.max(AccountProfile.version)).where(AccountProfile.account_id == aid)
    )
    max_version: int | None = ver_result.scalar_one_or_none()
    new_version = (max_version or 0) + 1

    # Insert status=generating row
    profile_id = uuid.uuid4()
    profile_row = AccountProfile(
        id=profile_id,
        account_id=aid,
        version=new_version,
        profile_json={},
        status="generating",
    )
    db.add(profile_row)
    await db.commit()

    try:
        # ── Build context ────────────────────────────────────────────────────
        stats: StatsSummary = await compute_stats(db, aid)
        stats_json = stats.model_dump_json(indent=None)

        # Classification aggregation
        cls_result = await db.execute(
            select(MediaClassification)
            .join(MediaItem, MediaClassification.media_item_id == MediaItem.id)
            .where(MediaItem.account_id == aid)
        )
        classifications = list(cls_result.scalars().all())

        topic_counter: Counter = Counter()
        tone_counter: Counter = Counter()
        lang_counter: Counter = Counter()
        cta_count = 0
        for cls in classifications:
            if cls.topic:
                topic_counter[cls.topic] += 1
            if cls.tone:
                tone_counter[cls.tone] += 1
            if cls.language:
                lang_counter[cls.language] += 1
            if cls.has_cta:
                cta_count += 1

        cls_agg = {
            "topic_distribution": dict(topic_counter.most_common(10)),
            "tone_distribution": dict(tone_counter.most_common()),
            "language_distribution": dict(lang_counter.most_common()),
            "cta_pct": round(cta_count / max(len(classifications), 1) * 100, 1),
        }

        # Top 10 / worst 3 captions (by ER proxy)
        top_post_ids = {str(p.ig_media_id) for p in stats.top_posts}
        worst_post_ids = {str(p.ig_media_id) for p in stats.worst_posts}

        items_result = await db.execute(
            select(MediaItem).where(MediaItem.account_id == aid)
        )
        all_items = {m.ig_media_id: m for m in items_result.scalars().all()}

        top_captions = [
            all_items[ig_id].caption
            for ig_id in top_post_ids
            if ig_id in all_items and all_items[ig_id].caption
        ][:10]
        worst_captions = [
            all_items[ig_id].caption
            for ig_id in worst_post_ids
            if ig_id in all_items and all_items[ig_id].caption
        ][:3]

        # Account metadata
        snap_result = await db.execute(
            select(AccountMetricsSnapshot)
            .where(AccountMetricsSnapshot.account_id == aid)
            .order_by(AccountMetricsSnapshot.snapshot_date.desc())
            .limit(1)
        )
        latest_snap = snap_result.scalar_one_or_none()

        from app.models.account import Account
        acc_result = await db.execute(
            select(Account).where(Account.id == aid)
        )
        account = acc_result.scalar_one_or_none()

        meta = {
            "username": account.account_name if account else "",
            "followers": latest_snap.followers_count if latest_snap else None,
        }

        system = (
            "Ti — ekspert Instagram SMM menedjeri. Faqat quyidagi schema bo'yicha JSON qaytar. "
            "Boshqa hech narsa yozma.\n"
            "Schema:\n"
            '{"niche": "string", "sub_niches": ["string"], '
            '"tone_of_voice": {"primary": "string", "description": "string", '
            '"emoji_usage": "none|light|heavy"}, '
            '"content_pillars": [{"name": "string", "share_pct": 0, '
            '"performance": "strong|average|weak"}], '
            '"audience_portrait": {"summary": "string", "likely_interests": ["string"]}, '
            '"language_strategy": "string", "strengths": ["string"], '
            '"weaknesses": ["string"], "summary_one_liner": "string"}\n'
            "Barcha matn qiymatlari captionlar qaysi tilda ko'p bo'lsa o'sha tilda (yoki o'zbek)."
        )

        prompt = (
            "Quyidagi Instagram akkaunt ma'lumotlari asosida akkaunt profilini yarating:\n\n"
            f"Akkaunt: {json.dumps(meta, ensure_ascii=False)}\n\n"
            f"Statistika:\n{stats_json}\n\n"
            f"Klassifikatsiya agregatsiyasi:\n{json.dumps(cls_agg, ensure_ascii=False)}\n\n"
            f"Top {len(top_captions)} eng yaxshi caption:\n"
            + "\n---\n".join(top_captions or ["(mavjud emas)"])
            + f"\n\nEng yomon {len(worst_captions)} caption:\n"
            + "\n---\n".join(worst_captions or ["(mavjud emas)"])
        )

        # ── AI call ──────────────────────────────────────────────────────────
        from app.services.ai.json_utils import complete_json_validated

        profile_validated: AccountProfileSchema = await _complete_json_with_429_guard(
            "analysis",
            system=system,
            prompt=prompt,
            schema=AccountProfileSchema,
            max_tokens=3000,
            temperature=0.3,
        )

        # Refresh profile row
        await db.refresh(profile_row)
        profile_row.profile_json = profile_validated.model_dump()
        profile_row.status = "ready"
        profile_row.model_used = _LAST_MODEL.get("model", "unknown")
        db.add(profile_row)
        await db.commit()

        logger.info(
            "analysis.profile: version=%d generated account_id=%s",
            new_version, account_id,
        )

    except _AllProviders429:
        await db.refresh(profile_row)
        profile_row.status = "failed"
        profile_row.error_message = "All AI providers rate-limited"
        db.add(profile_row)
        await db.commit()
        raise
    except Exception as exc:  # noqa: BLE001
        try:
            await db.refresh(profile_row)
            profile_row.status = "failed"
            profile_row.error_message = str(exc)[:500]
            db.add(profile_row)
            await db.commit()
        except Exception:  # noqa: BLE001
            pass
        logger.error("analysis.profile: failed account_id=%s: %s", account_id, exc)
        raise


# ---------------------------------------------------------------------------
# Step 5: generate recommendations
# ---------------------------------------------------------------------------

async def _generate_recommendations(db: AsyncSession, account_id: str) -> None:
    """Generate weekly recommendations from active profile + StatsSummary."""
    from app.models.analysis import AccountProfile, AIRecommendation
    from app.schemas.analysis import RecommendationsSchema, StatsSummary
    from app.services.analysis.stats import compute_stats

    aid = uuid.UUID(account_id)

    # Get latest ready profile
    profile_result = await db.execute(
        select(AccountProfile)
        .where(
            AccountProfile.account_id == aid,
            AccountProfile.status == "ready",
        )
        .order_by(AccountProfile.version.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    profile_json = profile.profile_json if profile else {}

    stats: StatsSummary = await compute_stats(db, aid)

    system = (
        "Sen Instagram SMM strategiyasi mutaxassisisan. Faqat quyidagi schema bo'yicha JSON qaytar:\n"
        '{"posting_schedule": [{"day": "monday", "hour": 19, "reason": "string"}], '
        '"format_advice": "string", "content_ideas_directions": ["string"], '
        '"hashtag_advice": "string", '
        '"growth_actions": [{"action": "string", "priority": "high|medium|low", '
        '"expected_impact": "string"}]}'
    )

    prompt = (
        "Quyidagi akkaunt profili va statistikasi asosida haftalik SMM tavsiyalar bering:\n\n"
        f"Akkaunt profili:\n{json.dumps(profile_json, ensure_ascii=False)}\n\n"
        f"Statistika:\n{stats.model_dump_json(indent=None)}"
    )

    recs: RecommendationsSchema = await _complete_json_with_429_guard(
        "analysis",
        system=system,
        prompt=prompt,
        schema=RecommendationsSchema,
        max_tokens=2000,
        temperature=0.3,
    )

    week_start = _current_week_monday()
    now = datetime.now(timezone.utc)
    model_used = _LAST_MODEL.get("model", "unknown")

    await db.execute(
        pg_insert(AIRecommendation)
        .values(
            id=uuid.uuid4(),
            account_id=aid,
            week_start=week_start,
            recommendations_json=recs.model_dump(),
            model_used=model_used,
            created_at=now,
        )
        .on_conflict_do_update(
            constraint="uq_ai_recommendations_account_week",
            set_={
                "recommendations_json": recs.model_dump(),
                "model_used": model_used,
            },
        )
    )
    await db.commit()

    logger.info(
        "analysis.recommendations: week_start=%s generated account_id=%s",
        week_start, account_id,
    )


# ---------------------------------------------------------------------------
# AI helpers — wrap complete_for_task / complete_json_validated with 429 guard
# ---------------------------------------------------------------------------

# Thread-local-ish dict to pass model name from completion back to caller
_LAST_MODEL: dict[str, str] = {}


async def _complete_for_task_with_429_guard(task_type, **kwargs):
    """Call complete_for_task; translate all-providers exhausted into _AllProviders429."""
    from app.services.ai.router import complete_for_task
    from app.services.ai.base import AICompletion

    try:
        completion: AICompletion = await complete_for_task(task_type, **kwargs)
        _LAST_MODEL["model"] = completion.model
        return completion
    except RuntimeError as exc:
        if "No AI provider" in str(exc) or "No providers" in str(exc):
            raise _AllProviders429(str(exc)) from exc
        raise
    except Exception as exc:  # noqa: BLE001
        # If all providers failed with 429-like errors
        msg = str(exc).lower()
        if "rate" in msg or "429" in msg or "quota" in msg or "exhausted" in msg:
            raise _AllProviders429(str(exc)) from exc
        raise


async def _complete_json_with_429_guard(task_type, *, schema, **kwargs):
    """Call complete_json_validated; translate exhaustion into _AllProviders429."""
    from app.services.ai.json_utils import complete_json_validated

    try:
        result = await complete_json_validated(task_type, schema=schema, **kwargs)
        return result
    except RuntimeError as exc:
        if "No AI provider" in str(exc) or "No providers" in str(exc):
            raise _AllProviders429(str(exc)) from exc
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if "rate" in msg or "429" in msg or "quota" in msg or "exhausted" in msg:
            raise _AllProviders429(str(exc)) from exc
        raise


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Beat task: daily_account_snapshot
# ---------------------------------------------------------------------------

@celery_app.task(
    name="contentflow.daily_account_snapshot",
    queue="analysis",
)
def daily_account_snapshot():
    """03:30 UTC daily — write account_metrics_snapshots for all active IG accounts."""
    asyncio.run(_daily_account_snapshot_async())


async def _daily_account_snapshot_async() -> None:
    from app.models.account import Account
    from app.models.analysis import AccountMetricsSnapshot
    from app.services.encryption import decrypt_credentials
    from app.services.instagram_insights import (
        fetch_account_insights,
        TokenExpiredError,
    )

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            result = await db.execute(
                select(Account).where(
                    Account.platform == "instagram",
                    Account.is_active == True,  # noqa: E712
                    Account.ig_user_id.isnot(None),
                )
            )
            accounts = list(result.scalars().all())

        logger.info("daily_snapshot: processing %d IG accounts", len(accounts))

        today = date.today()
        now = datetime.now(timezone.utc)

        for account in accounts:
            try:
                creds = decrypt_credentials(account.credentials)
                token = creds.get("access_token", "")
                ig_user_id = creds.get("ig_user_id") or account.ig_user_id or ""

                if not token or not ig_user_id:
                    continue

                acc_insights = await fetch_account_insights(token, ig_user_id)
                if not acc_insights:
                    logger.warning(
                        "daily_snapshot: no insights for account_id=%s", account.id
                    )
                    continue

                followers = _int(acc_insights.get("followers_count")) or 0
                following = _int(acc_insights.get("follows_count")) or 0
                media_count = _int(acc_insights.get("media_count")) or 0
                reach_28d = _int(acc_insights.get("reach"))
                impressions_28d = _int(acc_insights.get("views") or acc_insights.get("impressions"))
                profile_views_28d = _int(acc_insights.get("profile_views"))
                demographics = acc_insights.get("demographics")

                async with factory() as db:
                    await db.execute(
                        pg_insert(AccountMetricsSnapshot)
                        .values(
                            id=uuid.uuid4(),
                            account_id=account.id,
                            snapshot_date=today,
                            followers_count=followers,
                            following_count=following,
                            media_count=media_count,
                            reach_28d=reach_28d,
                            impressions_28d=impressions_28d,
                            profile_views_28d=profile_views_28d,
                            demographics=demographics,
                            raw=acc_insights,
                        )
                        .on_conflict_do_update(
                            constraint="uq_account_metrics_account_date",
                            set_={
                                "followers_count": followers,
                                "following_count": following,
                                "media_count": media_count,
                                "reach_28d": reach_28d,
                                "impressions_28d": impressions_28d,
                                "profile_views_28d": profile_views_28d,
                                "demographics": demographics,
                                "raw": acc_insights,
                            },
                        )
                    )
                    await db.commit()

                logger.info(
                    "daily_snapshot: account_id=%s followers=%d", account.id, followers
                )

            except TokenExpiredError:
                logger.warning(
                    "daily_snapshot: token expired for account_id=%s — skipping", account.id
                )
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "daily_snapshot: error for account_id=%s: %s", account.id, exc
                )
                # Continue with remaining accounts

    finally:
        await engine.dispose()


# ---------------------------------------------------------------------------
# Beat task: weekly_refresh
# ---------------------------------------------------------------------------

@celery_app.task(
    name="contentflow.weekly_refresh",
    queue="analysis",
)
def weekly_refresh():
    """Monday 04:00 UTC — enqueue run_initial_analysis for each active IG account
    with 60-second stagger between accounts.
    """
    asyncio.run(_weekly_refresh_async())


async def _weekly_refresh_async() -> None:
    from app.models.account import Account
    from app.models.analysis import AnalysisJob

    engine, factory = _session_factory()
    try:
        async with factory() as db:
            result = await db.execute(
                select(Account).where(
                    Account.platform == "instagram",
                    Account.is_active == True,  # noqa: E712
                )
            )
            accounts = list(result.scalars().all())

        logger.info("weekly_refresh: enqueueing %d IG accounts", len(accounts))

        for i, account in enumerate(accounts):
            countdown = i * 60  # 60 s stagger between accounts
            try:
                async with factory() as db:
                    job = AnalysisJob(
                        account_id=account.id,
                        job_type="weekly_refresh",
                        status="queued",
                        progress_pct=0,
                    )
                    db.add(job)
                    await db.flush()
                    job_id = str(job.id)
                    await db.commit()

                run_initial_analysis.apply_async(
                    args=[str(account.id), job_id],
                    countdown=countdown,
                    queue="analysis",
                )
                logger.info(
                    "weekly_refresh: enqueued account_id=%s job_id=%s countdown=%ds",
                    account.id, job_id, countdown,
                )
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "weekly_refresh: failed to enqueue account_id=%s: %s", account.id, exc
                )

    finally:
        await engine.dispose()
