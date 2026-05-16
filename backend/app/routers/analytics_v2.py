"""V2 Analytics extensions: PDF report + best posting time."""
import io
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostLog
from app.middleware.auth_middleware import get_current_user
from app.redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Redis cache helpers ──────────────────────────────────────────────────────

_CACHE_TTL = 3600  # 1 hour


async def _cache_get(key: str) -> dict | None:
    try:
        redis = get_redis()
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis cache get failed: %s", exc)
    return None


async def _cache_set(key: str, value: dict, ttl: int = _CACHE_TTL) -> None:
    try:
        redis = get_redis()
        await redis.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.warning("Redis cache set failed: %s", exc)


async def _cache_invalidate_user(user_id: str) -> None:
    """Called after a new post is created to invalidate analytics caches."""
    try:
        redis = get_redis()
        keys = await redis.keys(f"analytics:{user_id}:*")
        if keys:
            await redis.delete(*keys)
    except Exception as exc:
        logger.warning("Redis cache invalidate failed: %s", exc)


# ─── V2-ANA-004: Weekly PDF report ───────────────────────────────────────────


@router.post("/report")
async def generate_weekly_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a weekly analytics PDF report and return it as a file download.

    Also attempts to send the PDF to the user's connected Telegram channel(s).
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="reportlab package not installed. Run: pip install reportlab",
        )

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)

    # Fetch posts from last 7 days
    result = await db.execute(
        select(Post).where(
            Post.user_id == current_user.id,
            Post.created_at >= week_start,
        )
    )
    posts = result.scalars().all()

    published = [p for p in posts if p.status == "published"]
    failed = [p for p in posts if p.status == "failed"]
    scheduled = [p for p in posts if p.status == "scheduled"]

    # Per-platform breakdown
    platform_stats: dict[str, dict] = defaultdict(lambda: {"total": 0, "published": 0, "failed": 0})
    for post in posts:
        for entry in post.platforms or []:
            plat = str(entry).split(":")[0]
            platform_stats[plat]["total"] += 1
            if post.status == "published":
                platform_stats[plat]["published"] += 1
            elif post.status == "failed":
                platform_stats[plat]["failed"] += 1

    # Build PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    story = []
    title_style = styles["Title"]
    normal_style = styles["Normal"]
    h2_style = styles["Heading2"]

    story.append(Paragraph("ContentFlow — Weekly Analytics Report", title_style))
    story.append(Paragraph(
        f"Period: {week_start.strftime('%Y-%m-%d')} → {now.strftime('%Y-%m-%d')}",
        normal_style,
    ))
    story.append(Paragraph(f"User: {current_user.full_name or current_user.email}", normal_style))
    story.append(Spacer(1, 0.5*cm))

    # Summary table
    story.append(Paragraph("Summary", h2_style))
    summary_data = [
        ["Metric", "Count"],
        ["Total Posts Created", str(len(posts))],
        ["Published", str(len(published))],
        ["Failed", str(len(failed))],
        ["Scheduled (upcoming)", str(len(scheduled))],
    ]
    summary_table = Table(summary_data, colWidths=[10*cm, 6*cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6C63FF")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F4F4F8"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCDD")),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.5*cm))

    # Platform breakdown
    if platform_stats:
        story.append(Paragraph("Platform Breakdown", h2_style))
        plat_data = [["Platform", "Total", "Published", "Failed"]]
        for plat, stats in sorted(platform_stats.items()):
            plat_data.append([
                plat.title(),
                str(stats["total"]),
                str(stats["published"]),
                str(stats["failed"]),
            ])
        plat_table = Table(plat_data, colWidths=[6*cm, 4*cm, 4*cm, 4*cm])
        plat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00C4A0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F4F4F8"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCDD")),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(plat_table)
        story.append(Spacer(1, 0.5*cm))

    # Recent posts list
    if published:
        story.append(Paragraph("Published Posts (last 10)", h2_style))
        for post in published[:10]:
            caption_preview = (post.caption or "No caption")[:80]
            platform_names = ", ".join(str(e).split(":")[0].title() for e in (post.platforms or []))
            story.append(Paragraph(
                f"• [{platform_names}] {caption_preview}",
                normal_style,
            ))
        story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        f"Generated at {now.strftime('%Y-%m-%d %H:%M:%S')} UTC by ContentFlow",
        normal_style,
    ))

    doc.build(story)
    buffer.seek(0)
    pdf_bytes = buffer.read()

    # Attempt Telegram delivery
    telegram_sent = False
    try:
        from app.models.account import Account
        from app.services.encryption import decrypt_credentials
        tg_result = await db.execute(
            select(Account).where(
                Account.user_id == current_user.id,
                Account.platform == "telegram",
                Account.is_active == True,
            )
        )
        tg_accounts = tg_result.scalars().all()

        if tg_accounts:
            import httpx
            account = tg_accounts[0]
            creds = decrypt_credentials(account.credentials)
            bot_token = creds.get("bot_token", "")
            channel_id = creds.get("channel_id", "")
            if bot_token and channel_id:
                caption_text = (
                    f"📊 ContentFlow haftalik hisobot\n"
                    f"📅 {week_start.strftime('%d.%m')} — {now.strftime('%d.%m.%Y')}\n"
                    f"✅ Published: {len(published)} | ❌ Failed: {len(failed)} | ⏳ Scheduled: {len(scheduled)}"
                )
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{bot_token}/sendDocument",
                        data={"chat_id": channel_id, "caption": caption_text},
                        files={"document": (
                            f"report_{now.strftime('%Y%m%d')}.pdf",
                            pdf_bytes,
                            "application/pdf",
                        )},
                    )
                    if resp.status_code == 200 and resp.json().get("ok"):
                        telegram_sent = True
    except Exception as exc:
        logger.warning("Telegram PDF delivery failed: %s", exc)

    headers = {
        "Content-Disposition": f'attachment; filename="contentflow_report_{now.strftime("%Y%m%d")}.pdf"',
        "X-Telegram-Sent": str(telegram_sent).lower(),
    }
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers=headers,
    )


# ─── V2-ANA-005: Best posting time ───────────────────────────────────────────


class BestTimeResponse(BaseModel):
    hour: int
    day_of_week: int
    day_name: str
    sample_size: int
    score: float
    hourly_distribution: list[dict]
    daily_distribution: list[dict]
    recommendation: str


@router.get("/best-time", response_model=BestTimeResponse)
async def get_best_posting_time(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-ANA-005 — Analyse PostLog data to find the best hour and day to post."""
    cache_key = f"analytics:{current_user.id}:best-time"
    cached = await _cache_get(cache_key)
    if cached:
        return BestTimeResponse(**cached)

    # Fetch all post logs for published posts owned by this user
    result = await db.execute(
        select(PostLog, Post)
        .join(Post, PostLog.post_id == Post.id)
        .where(
            Post.user_id == current_user.id,
            PostLog.status == "success",
        )
        .order_by(PostLog.executed_at.asc())
    )
    rows = result.all()

    # Count successes per hour and per day-of-week
    hour_counts: dict[int, int] = defaultdict(int)
    day_counts: dict[int, int] = defaultdict(int)

    for log, post in rows:
        ts = log.executed_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        hour_counts[ts.hour] += 1
        day_counts[ts.weekday()] += 1  # 0=Monday

    sample_size = sum(hour_counts.values())

    # Fall back to sensible defaults if no data
    if sample_size == 0:
        best_hour = 18
        best_day = 2  # Wednesday
        score = 0.0
        hourly = [{"hour": h, "count": 0, "label": f"{h:02d}:00"} for h in range(24)]
        daily = [
            {"day": d, "day_name": _day_name(d), "count": 0}
            for d in range(7)
        ]
    else:
        best_hour = max(hour_counts, key=lambda h: hour_counts[h])
        best_day = max(day_counts, key=lambda d: day_counts[d])
        best_count = hour_counts[best_hour]
        score = round(best_count / sample_size, 3)

        hourly = [
            {"hour": h, "count": hour_counts.get(h, 0), "label": f"{h:02d}:00"}
            for h in range(24)
        ]
        daily = [
            {"day": d, "day_name": _day_name(d), "count": day_counts.get(d, 0)}
            for d in range(7)
        ]

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    recommendation = (
        f"Ma'lumotlar asosida eng yaxshi vaqt: {_day_name(best_day)}, soat {best_hour:02d}:00. "
        f"Bu {sample_size} muvaffaqiyatli post asosida hisoblangan."
        if sample_size > 0
        else "Hali yetarli ma'lumot yo'q. Bir necha post joylang va natijani kuting."
    )

    payload = {
        "hour": best_hour,
        "day_of_week": best_day,
        "day_name": day_names[best_day],
        "sample_size": sample_size,
        "score": score,
        "hourly_distribution": hourly,
        "daily_distribution": daily,
        "recommendation": recommendation,
    }

    await _cache_set(cache_key, payload)
    return BestTimeResponse(**payload)


def _day_name(d: int) -> str:
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][d % 7]
