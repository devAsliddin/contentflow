"""V5 — Statistical analysis module (AI-free).

Computes StatsSummary from the local DB (media_items, media_metrics,
account_metrics_snapshots). No LLM calls.
"""
from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import timezone

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import (
    AccountMetricsSnapshot,
    MediaItem,
    MediaMetric,
)
from app.schemas.analysis import (
    DateValue,
    FormatScore,
    HashtagScore,
    HourScore,
    StatsSummary,
    TopPost,
)

_HASHTAG_RE = re.compile(r"#(\w+)")


async def compute_stats(db: AsyncSession, account_id: uuid.UUID) -> StatsSummary:
    """Compute StatsSummary for an account from DB data.

    Raises ValueError if no media items are found (caller should return 404).
    """
    # ------------------------------------------------------------------
    # 1. Load media items
    # ------------------------------------------------------------------
    media_result = await db.execute(
        select(MediaItem)
        .where(MediaItem.account_id == account_id)
        .order_by(desc(MediaItem.posted_at))
    )
    media_items: list[MediaItem] = list(media_result.scalars().all())

    if not media_items:
        raise ValueError("No media items found for this account")

    media_ids = [m.id for m in media_items]

    # ------------------------------------------------------------------
    # 2. Load latest metric snapshot per media item
    # ------------------------------------------------------------------
    # Fetch all metrics ordered newest-first; we'll take the first per item.
    metrics_result = await db.execute(
        select(MediaMetric)
        .where(MediaMetric.media_item_id.in_(media_ids))
        .order_by(desc(MediaMetric.fetched_at))
    )
    all_metrics: list[MediaMetric] = list(metrics_result.scalars().all())

    # Map: media_item_id → latest MediaMetric
    latest_metric: dict[uuid.UUID, MediaMetric] = {}
    for m in all_metrics:
        if m.media_item_id not in latest_metric:
            latest_metric[m.media_item_id] = m

    # ------------------------------------------------------------------
    # 3. Load account snapshots for follower trend
    # ------------------------------------------------------------------
    snapshots_result = await db.execute(
        select(AccountMetricsSnapshot)
        .where(AccountMetricsSnapshot.account_id == account_id)
        .order_by(AccountMetricsSnapshot.snapshot_date)
    )
    snapshots: list[AccountMetricsSnapshot] = list(snapshots_result.scalars().all())

    # Latest snapshot for fallback ER calculation
    latest_snapshot = snapshots[-1] if snapshots else None
    followers = latest_snapshot.followers_count if latest_snapshot else None

    # ------------------------------------------------------------------
    # 4. Per-post engagement rates + aggregations
    # ------------------------------------------------------------------
    er_by_item: dict[uuid.UUID, tuple[float, str]] = {}  # id → (er, basis)
    hour_bucket: dict[tuple[int, int], list[float]] = defaultdict(list)
    format_bucket: dict[str, list[float]] = defaultdict(list)
    hashtag_bucket: dict[str, list[float]] = defaultdict(list)
    post_dates: list = []

    for item in media_items:
        metric = latest_metric.get(item.id)
        er, basis = _compute_er(item, metric, followers)

        er_by_item[item.id] = (er, basis)

        # Hour bucket (weekday × hour)
        posted = item.posted_at
        if posted.tzinfo is None:
            posted = posted.replace(tzinfo=timezone.utc)
        weekday = posted.weekday()  # 0=Monday
        hour = posted.hour
        hour_bucket[(weekday, hour)].append(er)

        # Format bucket
        format_bucket[item.media_type].append(er)

        # Hashtag bucket — prefer DB hashtags, else parse caption
        tags: list[str] = item.hashtags if isinstance(item.hashtags, list) else []
        if not tags and item.caption:
            tags = _HASHTAG_RE.findall(item.caption)
        for tag in tags:
            hashtag_bucket[tag.lower()].append(er)

        post_dates.append(posted.date())

    # ------------------------------------------------------------------
    # 5. Best posting hours (top 10 by avg ER with >0 posts)
    # ------------------------------------------------------------------
    hour_scores: list[HourScore] = []
    for (weekday, hour), ers in hour_bucket.items():
        hour_scores.append(HourScore(
            weekday=weekday,
            hour=hour,
            avg_er=round(sum(ers) / len(ers), 4),
            posts=len(ers),
        ))
    hour_scores.sort(key=lambda x: x.avg_er, reverse=True)
    best_hours = hour_scores[:10]

    # ------------------------------------------------------------------
    # 6. Format performance
    # ------------------------------------------------------------------
    format_scores: list[FormatScore] = []
    for fmt, ers in format_bucket.items():
        format_scores.append(FormatScore(
            media_type=fmt,
            avg_er=round(sum(ers) / len(ers), 4),
            post_count=len(ers),
        ))
    format_scores.sort(key=lambda x: x.avg_er, reverse=True)

    # ------------------------------------------------------------------
    # 7. Top hashtags (top 10)
    # ------------------------------------------------------------------
    hashtag_scores: list[HashtagScore] = []
    for tag, ers in hashtag_bucket.items():
        hashtag_scores.append(HashtagScore(
            hashtag=f"#{tag}",
            avg_er=round(sum(ers) / len(ers), 4),
            post_count=len(ers),
        ))
    hashtag_scores.sort(key=lambda x: x.avg_er, reverse=True)
    top_hashtags = hashtag_scores[:10]

    # ------------------------------------------------------------------
    # 8. Top 5 / worst 3 posts
    # ------------------------------------------------------------------
    item_map = {m.id: m for m in media_items}
    sorted_items = sorted(er_by_item.keys(), key=lambda k: er_by_item[k][0], reverse=True)

    def _make_top_post(item_id: uuid.UUID) -> TopPost:
        item = item_map[item_id]
        er, basis = er_by_item[item_id]
        return TopPost(
            media_item_id=item.id,
            ig_media_id=item.ig_media_id,
            permalink=item.permalink,
            posted_at=item.posted_at,
            engagement_rate=round(er, 4),
            er_basis=basis,
        )

    top_posts = [_make_top_post(mid) for mid in sorted_items[:5]]
    worst_posts = [_make_top_post(mid) for mid in sorted_items[-3:]]

    # ------------------------------------------------------------------
    # 9. Follower trend from snapshots
    # ------------------------------------------------------------------
    follower_trend: list[DateValue] = [
        DateValue(date=s.snapshot_date, value=float(s.followers_count))
        for s in snapshots
    ]

    # ------------------------------------------------------------------
    # 10. Period / frequency
    # ------------------------------------------------------------------
    if len(post_dates) >= 2:
        delta_days = (max(post_dates) - min(post_dates)).days or 1
    else:
        delta_days = 7  # default

    posting_frequency = len(media_items) / max(delta_days / 7, 1)

    all_ers = [er_by_item[mid][0] for mid in er_by_item]
    avg_er = round(sum(all_ers) / len(all_ers), 4) if all_ers else 0.0

    return StatsSummary(
        period_days=delta_days,
        total_posts=len(media_items),
        avg_engagement_rate=avg_er,
        best_posting_hours=best_hours,
        format_performance=format_scores,
        top_hashtags=top_hashtags,
        top_posts=top_posts,
        worst_posts=worst_posts,
        follower_trend=follower_trend,
        posting_frequency_per_week=round(posting_frequency, 2),
    )


# ---------------------------------------------------------------------------
# Internal ER helper
# ---------------------------------------------------------------------------

def _compute_er(
    item: MediaItem,
    metric: MediaMetric | None,
    followers: int | None,
) -> tuple[float, str]:
    """Compute engagement rate for a post.

    Returns (er, basis) where basis is 'reach' or 'followers'.
    Returns (0.0, 'followers') if no data available.
    """
    if metric is None:
        return 0.0, "followers"

    likes = metric.like_count or 0
    comments = metric.comments_count or 0
    saves = metric.saved_count or 0
    shares = metric.shares_count or 0
    engagements = likes + comments + saves + shares

    if metric.reach and metric.reach > 0:
        return engagements / metric.reach, "reach"

    if followers and followers > 0:
        return engagements / followers, "followers"

    return 0.0, "followers"
