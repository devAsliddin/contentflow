import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.schemas.post import CreatePostRequest, UpdatePostRequest, PostOut
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    post = Post(
        user_id=current_user.id,
        caption=data.caption,
        media_url=data.media_url,
        media_type=data.media_type,
        platforms=data.platforms,
        scheduled_at=data.scheduled_at,
        status="scheduled" if data.scheduled_at else "draft",
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    # Schedule via Celery if scheduled_at is set
    if data.scheduled_at and data.scheduled_at > datetime.now(timezone.utc):
        from app.tasks.post_tasks import schedule_post
        task = schedule_post.apply_async(args=[str(post.id)], eta=data.scheduled_at)
        post.celery_task_id = task.id
        db.add(post)
        await db.flush()
        await db.refresh(post)

    return PostOut.model_validate(post)


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
