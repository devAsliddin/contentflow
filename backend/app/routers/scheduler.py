from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


@router.post("/trigger/{post_id}")
async def trigger_post_now(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger immediate post publishing."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == current_user.id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status not in ("draft", "scheduled", "failed"):
        raise HTTPException(status_code=400, detail=f"Cannot trigger post with status: {post.status}")

    from app.tasks.post_tasks import _publish_post, get_async_session

    class ImmediatePublishTask:
        session_factory = get_async_session()

    result = await _publish_post(ImmediatePublishTask(), str(post.id))
    if not result or not result.get("success"):
        errors = [
            r.get("error")
            for r in (result or {}).get("results", [])
            if r.get("status") == "failed" and r.get("error")
        ]
        return {
            "task_id": None,
            "message": "Post yuborilmadi",
            "status": "failed",
            "errors": errors,
            "results": (result or {}).get("results", []),
        }

    return {
        "task_id": None,
        "message": "Post yuborildi",
        "status": "published",
        "errors": [],
        "results": result.get("results", []),
    }
