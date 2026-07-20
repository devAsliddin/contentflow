"""V5 — Analysis API endpoints.

All 6 endpoints require auth + account ownership:
  POST   /{id}/analysis/start
  GET    /{id}/analysis/status
  GET    /{id}/analysis/stats
  GET    /{id}/analysis/profile
  GET    /{id}/analysis/recommendations
  POST   /{id}/analysis/content-ideas

Mounted in main.py with prefix="/api/accounts".
"""
from __future__ import annotations

import json
import logging

from app.tasks.enqueue import fire_and_forget
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.account import Account
from app.models.analysis import (
    AccountProfile,
    AIRecommendation,
    AnalysisJob,
)
from app.models.user import User
from app.redis_client import get_redis
from app.schemas.analysis import (
    AccountProfileSchema,
    AnalysisJobOut,
    ContentIdeasRequest,
    ContentIdeasResponse,
    RecommendationsSchema,
    StartAnalysisResponse,
    StatsSummary,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Redis rate limit: content-ideas per user, 10/hour
_CONTENT_IDEAS_LIMIT = 10
_CONTENT_IDEAS_TTL = 3600  # 1 hour


# ---------------------------------------------------------------------------
# Ownership helper
# ---------------------------------------------------------------------------

async def _get_owned_account(
    db: AsyncSession,
    account_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Account:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


# ---------------------------------------------------------------------------
# POST /{id}/analysis/start
# ---------------------------------------------------------------------------

@router.post(
    "/{account_id}/analysis/start",
    response_model=StartAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["analysis-v5"],
)
async def start_analysis(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue an initial analysis job. Returns 409 if one is already active."""
    await _get_owned_account(db, account_id, current_user.id)

    # Check for active (non-terminal) job
    active_statuses = ("queued", "fetching", "computing", "classifying", "profiling")
    result = await db.execute(
        select(AnalysisJob).where(
            AnalysisJob.account_id == account_id,
            AnalysisJob.status.in_(active_statuses),
        )
    )
    active_job = result.scalar_one_or_none()
    if active_job:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Analysis already in progress (job_id={active_job.id}, status={active_job.status})",
        )

    # Create queued job
    job = AnalysisJob(
        account_id=account_id,
        job_type="initial_analysis",
        status="queued",
        progress_pct=0,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Enqueue Celery task — detached so a down/slow broker never stalls the request.
    def _enqueue() -> None:
        from app.tasks.analysis_tasks import run_initial_analysis  # type: ignore[import]
        run_initial_analysis.delay(str(account_id), str(job.id))

    fire_and_forget(_enqueue, label="initial_analysis")

    return StartAnalysisResponse(job_id=job.id, status=job.status)


# ---------------------------------------------------------------------------
# GET /{id}/analysis/status
# ---------------------------------------------------------------------------

@router.get(
    "/{account_id}/analysis/status",
    response_model=AnalysisJobOut,
    tags=["analysis-v5"],
)
async def get_analysis_status(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent analysis job for this account."""
    await _get_owned_account(db, account_id, current_user.id)

    result = await db.execute(
        select(AnalysisJob)
        .where(AnalysisJob.account_id == account_id)
        .order_by(desc(AnalysisJob.started_at), desc(AnalysisJob.id))
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No analysis job found")

    return AnalysisJobOut.model_validate(job)


# ---------------------------------------------------------------------------
# GET /{id}/analysis/stats
# ---------------------------------------------------------------------------

@router.get(
    "/{account_id}/analysis/stats",
    response_model=StatsSummary,
    tags=["analysis-v5"],
)
async def get_analysis_stats(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return computed statistics (AI-free). 404 if no media data yet."""
    await _get_owned_account(db, account_id, current_user.id)

    from app.services.analysis.stats import compute_stats

    try:
        stats = await compute_stats(db, account_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return stats


# ---------------------------------------------------------------------------
# GET /{id}/analysis/profile
# ---------------------------------------------------------------------------

@router.get(
    "/{account_id}/analysis/profile",
    response_model=AccountProfileSchema,
    tags=["analysis-v5"],
)
async def get_analysis_profile(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest ready account profile. 404 if none exists."""
    await _get_owned_account(db, account_id, current_user.id)

    result = await db.execute(
        select(AccountProfile)
        .where(
            AccountProfile.account_id == account_id,
            AccountProfile.status == "ready",
        )
        .order_by(desc(AccountProfile.version))
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis profile found — start analysis first",
        )

    return AccountProfileSchema.model_validate(profile.profile_json)


# ---------------------------------------------------------------------------
# GET /{id}/analysis/recommendations
# ---------------------------------------------------------------------------

@router.get(
    "/{account_id}/analysis/recommendations",
    response_model=RecommendationsSchema,
    tags=["analysis-v5"],
)
async def get_analysis_recommendations(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest weekly recommendations. 404 if none exist."""
    await _get_owned_account(db, account_id, current_user.id)

    result = await db.execute(
        select(AIRecommendation)
        .where(AIRecommendation.account_id == account_id)
        .order_by(desc(AIRecommendation.week_start))
        .limit(1)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recommendations found — start analysis first",
        )

    return RecommendationsSchema.model_validate(rec.recommendations_json)


# ---------------------------------------------------------------------------
# POST /{id}/analysis/content-ideas
# ---------------------------------------------------------------------------

@router.post(
    "/{account_id}/analysis/content-ideas",
    response_model=ContentIdeasResponse,
    tags=["analysis-v5"],
)
async def get_content_ideas(
    account_id: uuid.UUID,
    body: ContentIdeasRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate content ideas synchronously using AI.

    Rate limited: 10 requests per user per hour (Redis).
    Uses account profile + stats as context.
    """
    await _get_owned_account(db, account_id, current_user.id)

    # Redis rate limiting
    redis = get_redis()
    rate_key = f"content_ideas:{current_user.id}"
    current_count_raw = await redis.get(rate_key)
    current_count = int(current_count_raw) if current_count_raw else 0

    if current_count >= _CONTENT_IDEAS_LIMIT:
        ttl = await redis.ttl(rate_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {ttl} seconds.",
            headers={"Retry-After": str(ttl)},
        )

    # Increment counter
    pipe = redis.pipeline()
    await pipe.incr(rate_key)
    await pipe.expire(rate_key, _CONTENT_IDEAS_TTL)
    await pipe.execute()

    # Build context from profile + stats (best effort)
    profile_context = ""
    stats_context = ""

    profile_result = await db.execute(
        select(AccountProfile)
        .where(
            AccountProfile.account_id == account_id,
            AccountProfile.status == "ready",
        )
        .order_by(desc(AccountProfile.version))
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()
    if profile:
        profile_context = json.dumps(profile.profile_json, ensure_ascii=False)

    try:
        from app.services.analysis.stats import compute_stats
        stats = await compute_stats(db, account_id)
        stats_context = json.dumps(
            {
                "avg_er": stats.avg_engagement_rate,
                "top_formats": [
                    {"type": f.media_type, "avg_er": f.avg_er}
                    for f in stats.format_performance[:3]
                ],
                "top_hashtags": [h.hashtag for h in stats.top_hashtags[:5]],
            },
            ensure_ascii=False,
        )
    except ValueError:
        pass

    topic_line = f"\nTopic hint: {body.topic_hint}" if body.topic_hint else ""

    system = (
        "You are a creative SMM manager. Generate content ideas for an Instagram account "
        "based on the provided account profile and statistics. "
        "Return ONLY a JSON object matching this exact schema:\n"
        '{"ideas": [{"title": "string", "caption_draft": "string", '
        '"format": "IMAGE|VIDEO|CAROUSEL_ALBUM|REELS", "hashtags": ["string"]}]}\n'
        "No markdown, no explanation — only the JSON object."
    )

    prompt = (
        f"Generate {body.count} unique content idea(s) for this Instagram account.\n"
        f"{topic_line}\n\n"
        f"Account profile:\n{profile_context or 'Not available'}\n\n"
        f"Performance stats:\n{stats_context or 'Not available'}\n\n"
        f"Requirements:\n"
        f"- Match the account's tone and niche\n"
        f"- Include realistic caption drafts\n"
        f"- Suggest best-performing format\n"
        f"- Include 5-10 relevant hashtags per idea\n"
        f"- Vary the ideas (different topics/formats if possible)"
    )

    from app.services.ai.json_utils import complete_json_validated
    from app.services import credit_service

    await credit_service.consume(db, current_user, "content_ideas")
    result = await complete_json_validated(
        "content",
        system=system,
        prompt=prompt,
        schema=ContentIdeasResponse,
        max_tokens=2000,
        temperature=0.7,
    )

    return result
