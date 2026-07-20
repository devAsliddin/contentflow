"""V6 — AI Post Creator endpoints.

All endpoints require authentication. Ownership checks are enforced.

POST  /generate                     — generate 3 caption variants + image seed (sync)
POST  /{id}/regenerate-caption      — regenerate captions with optional feedback
POST  /{id}/generate-image          — create image_job + enqueue Celery task
GET   /image-jobs/{job_id}          — poll image job status
POST  /{id}/regenerate-image        — create new image job (re-generate image)
POST  /{id}/send-to-composer        — create Post draft, mark ai_post as sent_to_composer
GET   /                             — list user's AI post drafts (paginated)
DELETE /{id}                        — soft-delete (status='discarded')
"""
from __future__ import annotations

import asyncio
import logging
import uuid as _uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.ai_posts import AiPostDraft, ImageJob
from app.models.post import Post
from app.models.user import User
from app.redis_client import get_redis
from app.services import credit_service
from app.schemas.ai_posts import (
    AiPostDraftListResponse,
    AiPostDraftListItem,
    AiPostDraftOut,
    CaptionGenerationResult,
    GenerateImageResponse,
    GeneratePostRequest,
    ImageJobStatusResponse,
    ImagePromptResult,
    RegenerateCaptionRequest,
    RegenerateImageRequest,
    SendToComposerResponse,
)
from app.services.ai.json_utils import complete_json_validated

logger = logging.getLogger(__name__)

# Detached, best-effort image-generation enqueue. apply_async() is blocking
# broker I/O; calling it inline froze the request ~20s when the broker was down
# (the try/except caught the error but not the stall). Keep strong refs so the
# detached tasks aren't GC'd mid-flight.
_bg_tasks: set = set()


async def _enqueue_image_task(job_id: str) -> None:
    try:
        from app.tasks.image_tasks import generate_image_task  # noqa: PLC0415
        await asyncio.to_thread(
            generate_image_task.apply_async, args=[job_id], queue="images"
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_posts: could not enqueue generate_image_task: %s", exc)


def _detach_enqueue_image(job_id: str) -> None:
    task = asyncio.create_task(_enqueue_image_task(job_id))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
settings = get_settings()
router = APIRouter()

# ─── Redis rate limit key for image generation ────────────────────────────────
_IMAGE_RL_TTL = 3600  # 1 hour window


async def _check_image_rate_limit(user_id: str) -> None:
    """Raise 429 if the user has hit IMAGE_RATE_LIMIT_PER_USER_HOUR."""
    redis = get_redis()
    key = f"image_gen:{user_id}"
    count_str = await redis.get(key)
    count = int(count_str) if count_str else 0
    limit = settings.image_rate_limit_per_user_hour
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Image generation rate limit reached ({limit}/hour). Try again later.",
        )
    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, _IMAGE_RL_TTL)
    await pipe.execute()


# ─── Content type → Instagram placement ───────────────────────────────────────

def _placement_options(content_type: str) -> dict[str, dict[str, str]]:
    """Map a content type (post/story/reel) to Post.platform_options for Instagram.

    Matches the shape produced by the manual composer (NewPostPage):
    {"instagram": {"placement": "feed|story|reel", "aspect_ratio": "1:1|9:16"}}
    """
    if content_type == "story":
        return {"instagram": {"placement": "story", "aspect_ratio": "9:16"}}
    if content_type == "reel":
        return {"instagram": {"placement": "reel", "aspect_ratio": "9:16"}}
    return {"instagram": {"placement": "feed", "aspect_ratio": "1:1"}}


# ─── Ownership helper ─────────────────────────────────────────────────────────

async def _get_owned_draft(
    db: AsyncSession,
    draft_id: _uuid.UUID,
    user_id: _uuid.UUID,
) -> AiPostDraft:
    result = await db.execute(
        select(AiPostDraft).where(
            AiPostDraft.id == draft_id,
            AiPostDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    if draft.status == "discarded":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Draft has been discarded")
    return draft


# ─── AI helpers ───────────────────────────────────────────────────────────────

# How each content type should steer the caption style.
_CONTENT_TYPE_HINTS: dict[str, str] = {
    "post": "Format: feed post. Caption can be a few sentences with value and a clear CTA.",
    "story": "Format: Instagram Story. Keep it very short, punchy and casual — 1-2 lines, "
             "made for a vertical full-screen slide.",
    "reel": "Format: Reels / short video. Write a strong scroll-stopping hook in the first line, "
            "then a short caption suited to a short vertical video.",
}


async def _generate_captions(
    topic: str | None,
    platform_targets: list[str],
    profile_json: dict | None,
    feedback: str | None = None,
    content_type: str = "post",
) -> CaptionGenerationResult:
    """Call content AI to generate 3 caption variants."""
    platform_hint = ", ".join(platform_targets) if platform_targets else "social media"
    content_block = f"\n{_CONTENT_TYPE_HINTS.get(content_type, _CONTENT_TYPE_HINTS['post'])}"
    profile_block = ""
    if profile_json:
        niche = profile_json.get("niche", "")
        tone = profile_json.get("tone", "")
        pillars = profile_json.get("content_pillars", [])
        profile_block = (
            f"\nAccount profile — Niche: {niche}. Tone: {tone}. "
            f"Content pillars: {', '.join(pillars) if pillars else 'general'}."
        )

    feedback_block = f"\nUser feedback on previous version: {feedback}" if feedback else ""
    topic_block = f"\nTopic / idea: {topic}" if topic else ""

    system = (
        "You are a professional social media content writer. "
        "Generate exactly 3 distinct caption variants for the given topic and platform(s). "
        "Each variant should have a unique style (e.g. inspirational, informative, conversational). "
        "Also provide a short image_prompt_seed_idea in English describing the ideal image "
        "to accompany this post (max 30 words, NO text/lettering on image). "
        "Return ONLY a JSON object matching this schema exactly — no markdown, no explanation:\n"
        '{"variants": [{"caption": "...", "description": "...", "hashtags": ["..."], "cta": "..."}, ...], '
        '"image_prompt_seed_idea": "..."}'
    )
    prompt = (
        f"Platform(s): {platform_hint}{content_block}{profile_block}{topic_block}{feedback_block}\n\n"
        "Generate 3 caption variants now."
    )

    return await complete_json_validated(
        "content",
        system=system,
        prompt=prompt,
        schema=CaptionGenerationResult,
        max_tokens=2000,
        temperature=0.7,
    )


async def _generate_image_prompt(
    caption: str,
    seed_idea: str,
    style_hint: str | None = None,
    brand_colors: str | None = None,
) -> str:
    """Generate a detailed English image prompt from caption + seed idea."""
    style_block = f" Style hint: {style_hint}." if style_hint else ""
    color_block = f" Brand colors: {brand_colors}." if brand_colors else ""

    system = (
        "You are a visual art director. Create a single, detailed English image generation prompt "
        "for a social media post image. Important rules: "
        "1) The image must have NO text, words, or lettering anywhere. "
        "2) Be specific about composition, mood, lighting, and style. "
        "3) Max 60 words. "
        "Return ONLY a JSON object: {\"image_prompt\": \"...\"}"
    )
    prompt = (
        f"Post caption: {caption[:300]}\n"
        f"Seed idea: {seed_idea}{style_block}{color_block}\n\n"
        "Create the image generation prompt now."
    )

    result = await complete_json_validated(
        "content",
        system=system,
        prompt=prompt,
        schema=ImagePromptResult,
        max_tokens=300,
        temperature=0.5,
    )
    return result.image_prompt


async def _get_account_profile(db: AsyncSession, account_id: _uuid.UUID) -> dict | None:
    """Fetch the latest ready account profile, or None."""
    try:
        from app.models.analysis import AccountProfile  # noqa: PLC0415
        result = await db.execute(
            select(AccountProfile)
            .where(AccountProfile.account_id == account_id)
            .order_by(desc(AccountProfile.version))
            .limit(1)
        )
        profile = result.scalar_one_or_none()
        return profile.profile_json if profile else None
    except Exception as exc:  # noqa: BLE001
        logger.debug("ai_posts: could not fetch profile for account=%s: %s", account_id, exc)
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=AiPostDraftOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI post draft (3 caption variants)",
)
async def generate_post(
    body: GeneratePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Synchronously generate 3 caption variants + image seed idea."""
    # Validate account ownership if provided
    profile_json: dict | None = None
    if body.account_id:
        from app.models.account import Account  # noqa: PLC0415
        result = await db.execute(
            select(Account).where(
                Account.id == body.account_id,
                Account.user_id == current_user.id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        profile_json = await _get_account_profile(db, body.account_id)

    await credit_service.consume(db, current_user, "post_generate")
    try:
        gen_result = await _generate_captions(
            topic=body.topic,
            platform_targets=body.platform_targets,
            profile_json=profile_json,
            content_type=body.content_type,
        )
    except Exception as exc:
        logger.error("ai_posts: caption generation failed user=%s: %s", current_user.id, exc)
        raise HTTPException(status_code=503, detail="AI service unavailable. Please try again.")

    # Use first variant as the primary caption
    first = gen_result.variants[0]

    generation_meta: dict[str, Any] = {
        "variants": [v.model_dump() for v in gen_result.variants],
        "image_prompt_seed_idea": gen_result.image_prompt_seed_idea,
        "profile_used": profile_json is not None,
        "platform_targets": body.platform_targets,
        "content_type": body.content_type,
        "want_image": body.want_image,
    }

    draft = AiPostDraft(
        user_id=current_user.id,
        account_id=body.account_id,
        source="ai_recommendation" if body.idea_from_recommendation_id else "user_idea",
        topic_input=body.topic,
        caption=first.caption,
        description=first.description,
        hashtags=first.hashtags,
        status="ready",
        generation_meta=generation_meta,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.post(
    "/{draft_id}/regenerate-caption",
    response_model=AiPostDraftOut,
    summary="Regenerate captions (optionally with user feedback)",
)
async def regenerate_caption(
    draft_id: _uuid.UUID,
    body: RegenerateCaptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    draft = await _get_owned_draft(db, draft_id, current_user.id)

    profile_json: dict | None = None
    if draft.account_id:
        profile_json = await _get_account_profile(db, draft.account_id)

    platform_targets: list[str] = draft.generation_meta.get("platform_targets", [])

    await credit_service.consume(db, current_user, "caption")
    try:
        gen_result = await _generate_captions(
            topic=draft.topic_input,
            platform_targets=platform_targets,
            profile_json=profile_json,
            feedback=body.feedback,
            content_type=draft.generation_meta.get("content_type", "post"),
        )
    except Exception as exc:
        logger.error("ai_posts: regenerate-caption failed user=%s draft=%s: %s",
                     current_user.id, draft_id, exc)
        raise HTTPException(status_code=503, detail="AI service unavailable. Please try again.")

    first = gen_result.variants[0]
    draft.caption = first.caption
    draft.description = first.description
    draft.hashtags = first.hashtags

    meta = dict(draft.generation_meta)
    meta["variants"] = [v.model_dump() for v in gen_result.variants]
    meta["image_prompt_seed_idea"] = gen_result.image_prompt_seed_idea
    meta["profile_used"] = profile_json is not None
    draft.generation_meta = meta

    await db.commit()
    await db.refresh(draft)
    return draft


@router.post(
    "/{draft_id}/generate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start image generation job (async)",
)
async def generate_image_endpoint(
    draft_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue async image generation. Returns image_job_id for polling."""
    await _check_image_rate_limit(str(current_user.id))

    draft = await _get_owned_draft(db, draft_id, current_user.id)

    await credit_service.consume(db, current_user, "image")

    # Generate a proper image prompt from the caption using content AI
    seed_idea = draft.generation_meta.get("image_prompt_seed_idea", "")

    # Get brand colors from profile if available
    brand_colors: str | None = None
    if draft.account_id:
        profile_json = await _get_account_profile(db, draft.account_id)
        if profile_json:
            brand_colors = profile_json.get("brand_colors")

    try:
        image_prompt = await _generate_image_prompt(
            caption=draft.caption,
            seed_idea=seed_idea,
            brand_colors=brand_colors,
        )
    except Exception as exc:
        logger.error("ai_posts: image prompt generation failed: %s", exc)
        # Fall back to seed idea if AI fails
        image_prompt = seed_idea or f"Professional photo for: {draft.caption[:100]}"

    w, h = settings.image_default_size_wh

    # Create image job record
    job = ImageJob(
        user_id=current_user.id,
        draft_id=draft_id,
        image_prompt=image_prompt,
        provider="pending",   # will be set by Celery task
        model="pending",
        status="queued",
        width=w,
        height=h,
    )
    db.add(job)
    await db.flush()

    # Update draft to link to this job
    draft.image_job_id = job.id
    await db.commit()
    await db.refresh(job)

    # Enqueue Celery task — detached so a down/slow broker never stalls the request.
    _detach_enqueue_image(str(job.id))

    return GenerateImageResponse(image_job_id=job.id)


@router.get(
    "/image-jobs/{job_id}",
    response_model=ImageJobStatusResponse,
    summary="Poll image job status",
)
async def get_image_job(
    job_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImageJob).where(
            ImageJob.id == job_id,
            ImageJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Image job not found")

    image_url: str | None = None
    if job.status == "done" and job.file_path:
        # Convert absolute filesystem path to media URL
        media_dir = str(settings.media_dir).rstrip("/").rstrip("\\")
        fp = str(job.file_path).replace("\\", "/")
        if "ai_generated" in fp:
            # Extract relative path from ai_generated/ onwards
            idx = fp.find("ai_generated")
            rel = fp[idx:]
            image_url = f"/media/{rel}"
        else:
            image_url = None

    return ImageJobStatusResponse(
        id=job.id,
        status=job.status,
        image_url=image_url,
        error_message=job.error_message,
        provider=None,  # never expose provider to user
    )


@router.post(
    "/{draft_id}/regenerate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Regenerate image with optional style hint",
)
async def regenerate_image(
    draft_id: _uuid.UUID,
    body: RegenerateImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new image job with a fresh prompt (optionally guided by style_hint)."""
    await _check_image_rate_limit(str(current_user.id))

    draft = await _get_owned_draft(db, draft_id, current_user.id)

    await credit_service.consume(db, current_user, "image")

    seed_idea = draft.generation_meta.get("image_prompt_seed_idea", "")

    brand_colors: str | None = None
    if draft.account_id:
        profile_json = await _get_account_profile(db, draft.account_id)
        if profile_json:
            brand_colors = profile_json.get("brand_colors")

    try:
        image_prompt = await _generate_image_prompt(
            caption=draft.caption,
            seed_idea=seed_idea,
            style_hint=body.style_hint,
            brand_colors=brand_colors,
        )
    except Exception as exc:
        logger.error("ai_posts: image prompt (regen) generation failed: %s", exc)
        hint = body.style_hint or ""
        image_prompt = f"{seed_idea} {hint}".strip() or f"Professional photo for: {draft.caption[:100]}"

    w, h = settings.image_default_size_wh

    job = ImageJob(
        user_id=current_user.id,
        draft_id=draft_id,
        image_prompt=image_prompt,
        provider="pending",
        model="pending",
        status="queued",
        width=w,
        height=h,
    )
    db.add(job)
    await db.flush()

    draft.image_job_id = job.id
    await db.commit()
    await db.refresh(job)

    # Detached so a down/slow broker never stalls the request.
    _detach_enqueue_image(str(job.id))

    return GenerateImageResponse(image_job_id=job.id)


@router.post(
    "/{draft_id}/send-to-composer",
    response_model=SendToComposerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Post draft and send to composer",
)
async def send_to_composer(
    draft_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Convert AI draft → Post draft (status='draft'), mark AI draft as sent_to_composer."""
    draft = await _get_owned_draft(db, draft_id, current_user.id)

    # Resolve image URL if image job is done
    media_url: str | None = None
    media_type: str | None = None

    if draft.image_job_id:
        result = await db.execute(
            select(ImageJob).where(ImageJob.id == draft.image_job_id)
        )
        job = result.scalar_one_or_none()
        if job and job.status == "done" and job.file_path:
            fp = str(job.file_path).replace("\\", "/")
            if "ai_generated" in fp:
                idx = fp.find("ai_generated")
                rel = fp[idx:]
                media_url = f"/media/{rel}"
            media_type = "image"

    # Build platforms list from generation_meta
    platform_targets: list[str] = draft.generation_meta.get("platform_targets", [])

    # Carry the chosen content type (post/story/reel) into the Post's Instagram
    # placement so the composer + preview + publisher stay in sync.
    content_type: str = draft.generation_meta.get("content_type", "post")
    platform_options = _placement_options(content_type)

    # Create the Post draft
    post = Post(
        user_id=current_user.id,
        caption=draft.caption,
        media_url=media_url,
        media_type=media_type,
        platforms=platform_targets,
        platform_options=platform_options,
        status="draft",
    )
    db.add(post)
    await db.flush()

    # Mark AI draft as sent
    draft.status = "sent_to_composer"
    await db.commit()
    await db.refresh(post)

    logger.info(
        "ai_posts: sent to composer user=%s draft=%s post=%s",
        current_user.id, draft_id, post.id,
    )

    return SendToComposerResponse(post_id=post.id, draft_id=draft_id)


@router.get(
    "",
    response_model=AiPostDraftListResponse,
    summary="List AI post drafts (paginated)",
)
async def list_ai_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated list of non-discarded AI post drafts for the current user."""
    base_query = select(AiPostDraft).where(
        AiPostDraft.user_id == current_user.id,
        AiPostDraft.status != "discarded",
    )

    total_result = await db.execute(
        select(func.count()).select_from(
            base_query.subquery()
        )
    )
    total = total_result.scalar_one()

    result = await db.execute(
        base_query
        .order_by(desc(AiPostDraft.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    drafts = result.scalars().all()

    return AiPostDraftListResponse(
        items=[
            AiPostDraftListItem(
                id=d.id,
                caption=d.caption,
                status=d.status,
                image_job_id=d.image_job_id,
                created_at=d.created_at,
            )
            for d in drafts
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete(
    "/{draft_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Discard an AI post draft",
)
async def delete_ai_post(
    draft_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete: set status='discarded'."""
    result = await db.execute(
        select(AiPostDraft).where(
            AiPostDraft.id == draft_id,
            AiPostDraft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.status = "discarded"
    await db.commit()
