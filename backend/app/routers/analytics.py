from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    base_query = select(Post).where(
        Post.user_id == current_user.id,
        Post.created_at >= week_start,
    )

    async def count_by_status(status: str) -> int:
        result = await db.execute(
            select(func.count()).select_from(
                select(Post).where(
                    Post.user_id == current_user.id,
                    Post.created_at >= week_start,
                    Post.status == status,
                ).subquery()
            )
        )
        return result.scalar_one()

    total_result = await db.execute(
        select(func.count()).select_from(
            select(Post).where(
                Post.user_id == current_user.id,
                Post.created_at >= week_start,
            ).subquery()
        )
    )

    return {
        "total_posts": total_result.scalar_one(),
        "scheduled": await count_by_status("scheduled"),
        "published": await count_by_status("published"),
        "failed": await count_by_status("failed"),
        "week_start": week_start.isoformat(),
        "week_end": (week_start + timedelta(days=7)).isoformat(),
    }


@router.get("/by-platform")
async def get_by_platform(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).where(Post.user_id == current_user.id)
    )
    posts = result.scalars().all()

    platform_stats: dict[str, dict] = {}
    for post in posts:
        for platform_entry in (post.platforms or []):
            platform = platform_entry.split(":")[0]
            if platform not in platform_stats:
                platform_stats[platform] = {"platform": platform, "total": 0, "published": 0, "failed": 0}
            platform_stats[platform]["total"] += 1
            if post.status == "published":
                platform_stats[platform]["published"] += 1
            elif post.status == "failed":
                platform_stats[platform]["failed"] += 1

    return list(platform_stats.values())
