"""Celery beat periodic tasks — run by the celery beat scheduler."""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="contentflow.recover_missed_posts")
def recover_missed_posts():
    """Re-queue any scheduled posts whose scheduled_at has passed but weren't published.

    This handles cases where the server restarted before a Celery ETA task fired,
    or Redis lost tasks due to a restart without persistence enabled.
    """
    asyncio.run(_recover())


async def _recover():
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from sqlalchemy import select
    from app.config import get_settings
    from app.models.post import Post

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    now = datetime.now(timezone.utc)

    try:
        async with factory() as db:
            result = await db.execute(
                select(Post).where(
                    Post.status == "scheduled",
                    Post.scheduled_at <= now,
                )
            )
            missed = result.scalars().all()

            if not missed:
                return

            logger.warning(f"Recovering {len(missed)} missed scheduled post(s)")
            from app.tasks.post_tasks import schedule_post

            for post in missed:
                task = schedule_post.delay(str(post.id))
                post.status = "publishing"
                post.celery_task_id = task.id
                db.add(post)
                logger.info(f"Re-queued post {post.id} → Celery task {task.id}")

            await db.commit()
    finally:
        await engine.dispose()


@celery_app.task(name="contentflow.weekly_analytics_summary")
def weekly_analytics_summary():
    """V2-NOT-003 — Send weekly analytics summary via Telegram every Monday at 09:00 UTC."""
    asyncio.run(_send_weekly_summary())


async def _send_weekly_summary():
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from sqlalchemy import select, func
    from app.config import get_settings
    from app.models.user import User
    from app.models.account import Account
    from app.models.post import Post
    from app.services.telegram_service import send_post_to_telegram
    from app.services.encryption import decrypt_credentials

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)

    try:
        async with factory() as db:
            # Get all active users
            user_result = await db.execute(select(User).where(User.is_active == True))
            users = user_result.scalars().all()

            for user in users:
                try:
                    # Get Telegram accounts for this user
                    tg_result = await db.execute(
                        select(Account).where(
                            Account.user_id == user.id,
                            Account.platform == "telegram",
                            Account.is_active == True,
                        )
                    )
                    tg_accounts = tg_result.scalars().all()
                    if not tg_accounts:
                        continue

                    # Get weekly stats
                    posts_result = await db.execute(
                        select(Post).where(
                            Post.user_id == user.id,
                            Post.created_at >= week_start,
                        )
                    )
                    posts = posts_result.scalars().all()

                    published = sum(1 for p in posts if p.status == "published")
                    failed = sum(1 for p in posts if p.status == "failed")
                    scheduled = sum(1 for p in posts if p.status == "scheduled")

                    # Per-platform breakdown
                    platform_counts: dict[str, int] = {}
                    for post in posts:
                        for entry in (post.platforms or []):
                            plat = str(entry).split(":")[0]
                            platform_counts[plat] = platform_counts.get(plat, 0) + 1

                    platform_lines = "\n".join(
                        f"  • {p.title()}: {c} ta"
                        for p, c in sorted(platform_counts.items())
                    ) or "  Hali post yo'q"

                    msg = (
                        f"📊 ContentFlow Haftalik Hisobot\n"
                        f"📅 {week_start.strftime('%d.%m')} — {now.strftime('%d.%m.%Y')}\n\n"
                        f"✅ Published: {published}\n"
                        f"❌ Failed: {failed}\n"
                        f"⏳ Scheduled: {scheduled}\n"
                        f"📁 Jami: {len(posts)}\n\n"
                        f"📲 Platformalar:\n{platform_lines}\n\n"
                        f"🚀 Yangi hafta muvaffaqiyatli bo'lsin!"
                    )

                    for tg_acc in tg_accounts[:1]:  # send to first Telegram channel only
                        creds = decrypt_credentials(tg_acc.credentials)
                        bot_token = creds.get("bot_token", "")
                        channel_id = creds.get("channel_id", "")
                        if bot_token and channel_id:
                            await send_post_to_telegram(
                                bot_token=bot_token,
                                channel_id=channel_id,
                                caption=msg,
                            )
                            logger.info(f"Weekly summary sent to user {user.id}")

                except Exception as user_exc:
                    logger.warning(f"Weekly summary failed for user {user.id}: {user_exc}")
    finally:
        await engine.dispose()
