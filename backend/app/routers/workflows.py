"""V2 Workflow endpoints: status transitions, recycle, bulk upload, templates, OAuth migration."""
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.account import Account
from app.models.post_template import PostTemplate
from app.middleware.auth_middleware import get_current_user
from app.schemas.post import PostOut

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024
MAX_VIDEO_SIZE = 500 * 1024 * 1024
EXT_MAP = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "video/mp4": ".mp4", "video/quicktime": ".mov",
}

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["pending_review", "scheduled"],
    "pending_review": ["approved", "draft"],
    "approved": ["scheduled", "published"],
    "scheduled": ["draft"],
    "published": [],
    "failed": ["draft", "scheduled"],
    "publishing": [],
}


# ─── V2-WF-002: Status transition ─────────────────────────────────────────────

class StatusTransitionRequest(BaseModel):
    status: str = Field(..., description="Target status")
    scheduled_at: datetime | None = Field(default=None)


@router.put("/posts/{post_id}/status", response_model=PostOut)
async def transition_post_status(
    post_id: uuid.UUID,
    data: StatusTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-WF-002 — Transition post through approval workflow.

    Allowed: draft → pending_review → approved → scheduled/published
    Also: pending_review → draft (reject), failed → draft
    """
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    allowed = VALID_TRANSITIONS.get(post.status, [])
    if data.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{post.status}' to '{data.status}'. Allowed: {allowed}",
        )

    post.status = data.status

    if data.status == "scheduled" and data.scheduled_at:
        if data.scheduled_at.tzinfo is None:
            data.scheduled_at = data.scheduled_at.replace(tzinfo=timezone.utc)
        if data.scheduled_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
        post.scheduled_at = data.scheduled_at
        # Re-schedule Celery task
        if post.celery_task_id:
            try:
                from app.tasks.celery_app import celery_app
                celery_app.control.revoke(post.celery_task_id, terminate=True)
            except Exception:
                pass
        from app.tasks.post_tasks import schedule_post
        task = schedule_post.apply_async(args=[str(post.id)], eta=data.scheduled_at)
        post.celery_task_id = task.id

    db.add(post)
    await db.flush()
    await db.refresh(post)

    # Invalidate analytics cache
    try:
        from app.routers.analytics_v2 import _cache_invalidate_user
        await _cache_invalidate_user(str(current_user.id))
    except Exception:
        pass

    return PostOut.model_validate(post)


# ─── V2-WF-003: Recycle / Repost ──────────────────────────────────────────────

class RecycleRequest(BaseModel):
    scheduled_at: datetime = Field(..., description="New scheduled time")


@router.post("/posts/{post_id}/recycle", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def recycle_post(
    post_id: uuid.UUID,
    data: RecycleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-WF-003 — Duplicate a published post with a new scheduled time."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    if original.status not in ("published", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Can only recycle published or failed posts. Current status: {original.status}",
        )

    scheduled_at = data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")

    new_post = Post(
        user_id=current_user.id,
        caption=original.caption,
        media_url=original.media_url,
        media_type=original.media_type,
        platforms=original.platforms,
        platform_options=original.platform_options,
        scheduled_at=scheduled_at,
        status="scheduled",
    )
    db.add(new_post)
    await db.flush()
    await db.refresh(new_post)

    from app.tasks.post_tasks import schedule_post
    task = schedule_post.apply_async(args=[str(new_post.id)], eta=scheduled_at)
    new_post.celery_task_id = task.id
    db.add(new_post)
    await db.flush()
    await db.refresh(new_post)

    return PostOut.model_validate(new_post)


# ─── V2-WF-004: Bulk Upload ───────────────────────────────────────────────────

class BulkUploadItem(BaseModel):
    url: str
    filename: str
    media_type: str
    size_bytes: int
    error: str | None = None


class BulkUploadResponse(BaseModel):
    uploaded: int
    failed: int
    items: list[BulkUploadItem]


@router.post("/upload/bulk", response_model=BulkUploadResponse)
async def bulk_upload_media(
    files: list[UploadFile] = File(..., description="Up to 10 files"),
    current_user: User = Depends(get_current_user),
):
    """V2-WF-004 — Upload up to 10 media files in a single request."""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per request")

    items: list[BulkUploadItem] = []
    uploaded = 0
    failed = 0

    media_path = Path(settings.media_dir)
    media_path.mkdir(parents=True, exist_ok=True)

    for file in files:
        content_type = file.content_type or ""
        is_image = content_type in ALLOWED_IMAGE_TYPES
        is_video = content_type in ALLOWED_VIDEO_TYPES

        if not is_image and not is_video:
            items.append(BulkUploadItem(
                url="", filename=file.filename or "unknown",
                media_type="unknown", size_bytes=0,
                error=f"Unsupported file type: {content_type}",
            ))
            failed += 1
            continue

        try:
            contents = await file.read()
            size = len(contents)
            max_size = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE
            media_type = "image" if is_image else "video"

            if size > max_size:
                limit_mb = max_size // (1024 * 1024)
                items.append(BulkUploadItem(
                    url="", filename=file.filename or "unknown",
                    media_type=media_type, size_bytes=size,
                    error=f"File too large. Max {limit_mb}MB",
                ))
                failed += 1
                continue

            ext = EXT_MAP.get(content_type, ".bin")
            filename = f"{uuid.uuid4()}{ext}"
            file_path = media_path / filename

            async with aiofiles.open(file_path, "wb") as f:
                await f.write(contents)

            items.append(BulkUploadItem(
                url=f"/media/{filename}",
                filename=filename,
                media_type=media_type,
                size_bytes=size,
            ))
            uploaded += 1
        except Exception as exc:
            logger.exception("Bulk upload error for %s: %s", file.filename, exc)
            items.append(BulkUploadItem(
                url="", filename=file.filename or "unknown",
                media_type="unknown", size_bytes=0,
                error=str(exc),
            ))
            failed += 1

    return BulkUploadResponse(uploaded=uploaded, failed=failed, items=items)


# ─── V2-WF-005: Post Templates ────────────────────────────────────────────────

class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    caption: str | None = None
    platforms: list[str] = Field(default_factory=list)
    platform_options: dict = Field(default_factory=dict)
    hashtags: list[str] = Field(default_factory=list)
    media_type: str | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    caption: str | None
    platforms: list[str]
    platform_options: dict
    hashtags: list[str]
    media_type: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-WF-005 — List all post templates for the current user."""
    result = await db.execute(
        select(PostTemplate)
        .where(PostTemplate.user_id == current_user.id)
        .order_by(PostTemplate.created_at.desc())
    )
    return [TemplateOut.model_validate(t) for t in result.scalars().all()]


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-WF-005 — Create a new post template."""
    template = PostTemplate(
        user_id=current_user.id,
        name=data.name,
        caption=data.caption,
        platforms=data.platforms,
        platform_options=data.platform_options,
        hashtags=data.hashtags,
        media_type=data.media_type,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PostTemplate).where(
            PostTemplate.id == template_id,
            PostTemplate.user_id == current_user.id,
        )
    )
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateOut.model_validate(tmpl)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-WF-005 — Delete a post template."""
    result = await db.execute(
        select(PostTemplate).where(
            PostTemplate.id == template_id,
            PostTemplate.user_id == current_user.id,
        )
    )
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)


# ─── V2-ACC-003: OAuth migration status ──────────────────────────────────────

class MigrationStatusItem(BaseModel):
    account_id: str
    account_name: str
    platform: str
    oauth_migrated: bool
    oauth_migrated_at: datetime | None
    needs_reconnect: bool


class MigrationStatusResponse(BaseModel):
    total: int
    migrated: int
    needs_reconnect: int
    accounts: list[MigrationStatusItem]


@router.get("/accounts/migration-status", response_model=MigrationStatusResponse)
async def get_migration_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-ACC-003 — Return OAuth2 migration status for all connected accounts."""
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.is_active == True,
        )
    )
    accounts = result.scalars().all()

    items = []
    migrated_count = 0
    needs_count = 0

    from app.services.encryption import decrypt_credentials

    for acc in accounts:
        # needs_reconnect only if credentials are missing/empty (genuinely broken)
        try:
            creds = decrypt_credentials(acc.credentials)
            has_creds = bool(creds)
        except Exception:
            has_creds = False

        needs_reconnect = not has_creds

        if getattr(acc, "oauth_migrated", False):
            migrated_count += 1
        if needs_reconnect:
            needs_count += 1

        items.append(MigrationStatusItem(
            account_id=str(acc.id),
            account_name=acc.account_name,
            platform=acc.platform,
            oauth_migrated=getattr(acc, "oauth_migrated", True),
            oauth_migrated_at=getattr(acc, "oauth_migrated_at", None),
            needs_reconnect=needs_reconnect,
        ))

    return MigrationStatusResponse(
        total=len(accounts),
        migrated=migrated_count,
        needs_reconnect=needs_count,
        accounts=items,
    )


@router.post("/accounts/mark-all-migrated")
async def mark_all_accounts_migrated(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all existing accounts as oauth_migrated=True (one-time fix for legacy accounts)."""
    from datetime import datetime, timezone as tz
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.is_active == True,
        )
    )
    accounts = result.scalars().all()
    now = datetime.now(tz.utc)
    updated = 0
    for acc in accounts:
        if not getattr(acc, "oauth_migrated", False):
            acc.oauth_migrated = True
            acc.oauth_migrated_at = now
            db.add(acc)
            updated += 1
    await db.flush()
    return {"updated": updated, "message": f"{updated} account(s) marked as migrated."}
