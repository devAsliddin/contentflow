import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.account import Account
from app.schemas.post import (
    CreatePostRequest,
    UpdatePostRequest,
    PostOut,
    PostReviewOut,
    PostReviewTarget,
)
from app.middleware.auth_middleware import get_current_user

router = APIRouter()
settings = get_settings()


def _option_value(data: CreatePostRequest | UpdatePostRequest, platform: str, key: str) -> str | None:
    options = (data.platform_options or {}).get(platform)
    if not options:
        return None
    if hasattr(options, "model_dump"):
        return options.model_dump(exclude_none=True).get(key)
    return options.get(key)


def _default_placement(platform: str, media_type: str | None) -> str | None:
    if platform == "instagram":
        return "reel" if media_type == "video" else "feed"
    if platform == "tiktok":
        return "post"
    return None


def _default_aspect_ratio(platform: str, media_type: str | None, placement: str | None) -> str | None:
    if platform == "instagram":
        if placement in ("reel", "story"):
            return "9:16"
        if media_type == "image":
            return "1:1"
        return "16:9"
    if platform == "tiktok":
        return "9:16"
    return None


def _media_file_exists(media_url: str | None) -> bool:
    if not media_url or not media_url.startswith("/media/"):
        return True
    filename = media_url[len("/media/"):]
    return (Path(settings.media_dir) / filename).is_file()


async def _review_post_payload(
    data: CreatePostRequest,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> PostReviewOut:
    errors: list[str] = []
    warnings: list[str] = []
    targets: list[PostReviewTarget] = []

    if not data.platforms:
        errors.append("Select at least one account")
    if not (data.caption or "").strip() and not data.media_url:
        errors.append("Caption yoki media kiriting")

    for platform_entry in data.platforms or []:
        platform = "unknown"
        account_id_str = ""
        account = None
        target_errors: list[str] = []
        notes: list[str] = []

        entry = str(platform_entry)
        parts = entry.split(":", 1)
        if len(parts) == 2:
            platform, account_id_str = parts
        else:
            account_id_str = entry

        try:
            account_id = uuid.UUID(account_id_str)
            result = await db.execute(
                select(Account).where(
                    Account.id == account_id,
                    Account.user_id == user_id,
                    Account.is_active == True,
                )
            )
            account = result.scalar_one_or_none()
        except ValueError:
            account = None

        if not account:
            target_errors.append(f"Account topilmadi: {account_id_str or entry}")
        else:
            if platform == "unknown":
                platform = account.platform
            if platform != account.platform:
                target_errors.append(
                    f"{account.account_name}: platform mos emas ({platform} != {account.platform})"
                )

        placement = _option_value(data, platform, "placement") or _default_placement(platform, data.media_type)
        aspect_ratio = (
            _option_value(data, platform, "aspect_ratio")
            or _default_aspect_ratio(platform, data.media_type, placement)
        )

        if platform == "instagram":
            if not data.media_url:
                target_errors.append("Instagram text-only postni qabul qilmaydi. Rasm yoki video yuklang.")
            elif data.media_type not in ("image", "video"):
                target_errors.append("Instagram uchun media turi image yoki video bo'lishi kerak.")
            elif not _media_file_exists(data.media_url):
                target_errors.append("Instagram media fayli serverda topilmadi. Qayta upload qiling.")

            if data.media_type == "image" and placement == "reel":
                target_errors.append("Instagram Reel uchun video kerak. Rasmni Feed yoki Story qilib yuboring.")
            if data.media_type == "video" and placement not in ("feed", "reel", "story"):
                target_errors.append("Instagram video uchun Feed, Reel yoki Story tanlang.")
            if data.media_type == "image" and placement not in ("feed", "story"):
                target_errors.append("Instagram rasm uchun Feed yoki Story tanlang.")
            if placement in ("reel", "story") and aspect_ratio != "9:16":
                warnings.append(f"{account.account_name if account else 'Instagram'}: Story/Reel uchun 9:16 yaxshi ishlaydi.")
                notes.append("Story/Reel uchun 9:16 tavsiya qilinadi.")

        elif platform == "tiktok":
            if data.media_type != "video" or not data.media_url:
                target_errors.append("TikTok faqat video postni qabul qiladi.")
            elif not _media_file_exists(data.media_url):
                target_errors.append("TikTok video fayli serverda topilmadi. Qayta upload qiling.")
            elif data.media_url.startswith("/media/") and "localhost" in settings.backend_url:
                warnings.append("TikTok publish uchun BACKEND_URL public HTTPS domen bo'lishi kerak.")
                notes.append("TikTok uchun public video URL kerak.")
            if placement != "post":
                target_errors.append("TikTok uchun hozircha faqat Post qo'llanadi.")
            if aspect_ratio not in ("9:16", "16:9"):
                target_errors.append("TikTok video formati 9:16 yoki 16:9 bo'lishi kerak.")

        elif platform == "telegram":
            if data.media_url and not _media_file_exists(data.media_url):
                target_errors.append("Telegram media fayli serverda topilmadi. Qayta upload qiling.")

        elif platform != "unknown":
            target_errors.append(f"Unsupported platform: {platform}")

        if target_errors:
            errors.extend(target_errors)

        targets.append(
            PostReviewTarget(
                platform=platform,
                account_id=str(account.id) if account else account_id_str or None,
                account_name=account.account_name if account else None,
                status="blocked" if target_errors else "ready",
                placement=placement,
                aspect_ratio=aspect_ratio,
                notes=target_errors or notes,
            )
        )

    return PostReviewOut(
        ok=not errors,
        errors=errors,
        warnings=warnings,
        targets=targets,
    )


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone

    review = await _review_post_payload(data, current_user.id, db)
    if not review.ok:
        raise HTTPException(status_code=400, detail="; ".join(review.errors))

    scheduled_at = data.scheduled_at
    if scheduled_at and scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at and scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")

    post = Post(
        user_id=current_user.id,
        caption=data.caption,
        media_url=data.media_url,
        media_type=data.media_type,
        platforms=data.platforms,
        platform_options={
            platform: options.model_dump(exclude_none=True)
            for platform, options in (data.platform_options or {}).items()
        },
        scheduled_at=scheduled_at,
        status="scheduled" if scheduled_at else "draft",
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    # Schedule via Celery if scheduled_at is set
    if scheduled_at:
        from app.tasks.post_tasks import schedule_post
        task = schedule_post.apply_async(args=[str(post.id)], eta=scheduled_at)
        post.celery_task_id = task.id
        db.add(post)
        await db.flush()
        await db.refresh(post)

    # V2-INFRA-002: invalidate analytics Redis cache after post creation
    try:
        from app.routers.analytics_v2 import _cache_invalidate_user
        await _cache_invalidate_user(str(current_user.id))
    except Exception:
        pass

    return PostOut.model_validate(post)


@router.post("/review", response_model=PostReviewOut)
async def review_post(
    data: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _review_post_payload(data, current_user.id, db)


@router.get("", response_model=list[PostOut])
async def list_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Post).where(Post.user_id == current_user.id)
    if status_filter:
        query = query.where(Post.status == status_filter)
    query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [PostOut.model_validate(p) for p in result.scalars().all()]


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostOut.model_validate(post)


@router.put("/{post_id}", response_model=PostOut)
async def update_post(
    post_id: uuid.UUID,
    data: UpdatePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)

    db.add(post)
    await db.flush()
    await db.refresh(post)
    return PostOut.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Cancel Celery task if scheduled
    if post.celery_task_id:
        from app.tasks.celery_app import celery_app
        celery_app.control.revoke(post.celery_task_id, terminate=True)

    await db.delete(post)
