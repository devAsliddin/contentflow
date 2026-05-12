import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.models.follower_snapshot import FollowerSnapshot
from app.models.post import Post
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


class FollowerSnapshotCreate(BaseModel):
    account_id: uuid.UUID
    follower_count: int = Field(..., ge=0)
    following_count: int | None = Field(default=None, ge=0)
    media_count: int | None = Field(default=None, ge=0)
    captured_at: datetime | None = None
    source: str = Field(default="manual", max_length=50)


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


# ─── V2 Analytics ─────────────────────────────────────────────────────────────


def _placeholder_metrics(post_id: str, platform: str) -> dict:
    """Return deterministic placeholder engagement metrics seeded from post_id."""
    seed = sum(ord(c) for c in str(post_id))
    likes = (seed % 500) + 10
    views = likes * ((seed % 8) + 3)
    reach = int(views * 0.8)
    return {"likes": likes, "views": views, "reach": reach}


def _date_labels(days: int) -> list[str]:
    today = datetime.now(timezone.utc).date()
    return [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


def _snapshot_payload(snapshot: FollowerSnapshot) -> dict:
    return {
        "id": str(snapshot.id),
        "account_id": str(snapshot.account_id) if snapshot.account_id else None,
        "platform": snapshot.platform,
        "follower_count": snapshot.follower_count,
        "following_count": snapshot.following_count,
        "media_count": snapshot.media_count,
        "source": snapshot.source,
        "captured_at": snapshot.captured_at.isoformat(),
    }


@router.get("/posts")
async def get_posts_performance(
    days: int = Query(default=7, ge=1, le=90, description="Look-back window in days"),
    platform: str | None = Query(default=None, description="Filter by platform"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-ANA-001 — Post performance dashboard.

    Returns posts with engagement metrics. Real platform metrics are a V2 phase-2
    feature; for now metrics are derived from stored post_logs data enriched with
    placeholder values.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(Post)
        .where(
            Post.user_id == current_user.id,
            Post.created_at >= since,
            Post.status == "published",
        )
        .order_by(Post.created_at.desc())
    )
    result = await db.execute(query)
    posts = result.scalars().all()

    items = []
    for post in posts:
        post_platforms = [p.split(":")[0] for p in (post.platforms or [])]

        # If platform filter applied, skip posts not on that platform
        if platform and platform not in post_platforms:
            continue

        caption_preview = (post.caption or "")[:120]
        primary_platform = post_platforms[0] if post_platforms else "unknown"
        if platform:
            primary_platform = platform

        metrics = _placeholder_metrics(str(post.id), primary_platform)

        items.append({
            "post_id": str(post.id),
            "caption_preview": caption_preview,
            "platform": primary_platform,
            "likes": metrics["likes"],
            "views": metrics["views"],
            "reach": metrics["reach"],
            "published_at": post.updated_at.isoformat() if post.updated_at else post.created_at.isoformat(),
        })

    return {"days": days, "platform": platform, "total": len(items), "posts": items}


@router.get("/platforms")
@router.get("/platforms/comparison")
async def get_platforms_comparison(
    days: int = Query(default=7, ge=1, le=90, description="Look-back window in days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-ANA-002 — Per-platform daily breakdown for chart rendering.

    Returns a list of per-platform objects each containing parallel date,
    post_count and published_count arrays for the last N days.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Post).where(
            Post.user_id == current_user.id,
            Post.created_at >= since,
        )
    )
    posts = result.scalars().all()

    # Build date labels
    today = datetime.now(timezone.utc).date()
    date_labels = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    # per_platform[platform][date] = {total, published}
    per_platform: dict[str, dict[str, dict]] = {}

    for post in posts:
        post_date = post.created_at.date().isoformat()
        if post_date not in date_labels:
            continue

        for platform_entry in (post.platforms or []):
            plat = platform_entry.split(":")[0]
            if plat not in per_platform:
                per_platform[plat] = {d: {"total": 0, "published": 0} for d in date_labels}
            if post_date in per_platform[plat]:
                per_platform[plat][post_date]["total"] += 1
                if post.status == "published":
                    per_platform[plat][post_date]["published"] += 1

    comparison = []
    for plat, daily in per_platform.items():
        comparison.append({
            "platform": plat,
            "dates": date_labels,
            "post_counts": [daily[d]["total"] for d in date_labels],
            "published_counts": [daily[d]["published"] for d in date_labels],
        })

    return {"days": days, "platforms": comparison}


@router.post("/followers/snapshots", status_code=status.HTTP_201_CREATED)
async def create_follower_snapshot(
    data: FollowerSnapshotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a follower count snapshot for one connected account.

    This gives scheduled jobs and admin tools a stable V2 ingestion point while
    platform-specific follower fetchers are added over time.
    """
    account_result = await db.execute(
        select(Account).where(
            Account.id == data.account_id,
            Account.user_id == current_user.id,
            Account.is_active == True,
        )
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    snapshot = FollowerSnapshot(
        user_id=current_user.id,
        account_id=account.id,
        platform=account.platform,
        follower_count=data.follower_count,
        following_count=data.following_count,
        media_count=data.media_count,
        source=data.source,
        captured_at=data.captured_at or datetime.now(timezone.utc),
    )
    db.add(snapshot)
    await db.flush()
    await db.refresh(snapshot)

    return _snapshot_payload(snapshot)


@router.get("/followers")
async def get_follower_growth(
    days: int = Query(default=30, ge=1, le=365, description="Look-back window in days"),
    platform: str | None = Query(default=None, description="Filter by platform"),
    account_id: uuid.UUID | None = Query(default=None, description="Filter by connected account"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-ANA-003 - follower growth dynamics.

    Returns a continuous daily series by carrying each account's latest known
    follower count forward until a newer snapshot exists.
    """
    labels = _date_labels(days)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(FollowerSnapshot, Account.account_name)
        .join(Account, FollowerSnapshot.account_id == Account.id, isouter=True)
        .where(
            FollowerSnapshot.user_id == current_user.id,
            FollowerSnapshot.captured_at >= since,
        )
        .order_by(FollowerSnapshot.captured_at.asc())
    )
    if platform:
        query = query.where(FollowerSnapshot.platform == platform)
    if account_id:
        query = query.where(FollowerSnapshot.account_id == account_id)

    result = await db.execute(query)
    rows = result.all()

    latest_by_account_day: dict[tuple[str, str], FollowerSnapshot] = {}
    account_meta: dict[str, dict] = {}

    for snapshot, account_name in rows:
        account_key = str(snapshot.account_id) if snapshot.account_id else f"{snapshot.platform}:unlinked"
        captured_at = snapshot.captured_at
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)
        day = captured_at.date().isoformat()
        if day not in labels:
            continue

        account_meta[account_key] = {
            "account_id": str(snapshot.account_id) if snapshot.account_id else None,
            "account_name": account_name or snapshot.platform.title(),
            "platform": snapshot.platform,
        }

        key = (account_key, day)
        current = latest_by_account_day.get(key)
        if current is None or snapshot.captured_at > current.captured_at:
            latest_by_account_day[key] = snapshot

    series = [
        {"date": label, "telegram": 0, "instagram": 0, "tiktok": 0, "total": 0}
        for label in labels
    ]
    by_date = {item["date"]: item for item in series}
    account_series: list[dict] = []

    for account_key, meta in account_meta.items():
        last_snapshot: FollowerSnapshot | None = None
        points = []

        for label in labels:
            snapshot = latest_by_account_day.get((account_key, label))
            if snapshot:
                last_snapshot = snapshot

            followers = last_snapshot.follower_count if last_snapshot else 0
            points.append({"date": label, "followers": followers})

            if followers:
                row = by_date[label]
                platform_name = meta["platform"]
                row[platform_name] = row.get(platform_name, 0) + followers
                row["total"] += followers

        non_zero_points = [point for point in points if point["followers"] > 0]
        first_count = non_zero_points[0]["followers"] if non_zero_points else 0
        latest_count = non_zero_points[-1]["followers"] if non_zero_points else 0

        account_series.append({
            **meta,
            "latest_count": latest_count,
            "delta": latest_count - first_count,
            "series": points,
        })

    return {
        "days": days,
        "platform": platform,
        "account_id": str(account_id) if account_id else None,
        "series": series,
        "accounts": account_series,
    }
