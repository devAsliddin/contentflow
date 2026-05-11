"""Celery tasks for publishing posts to social platforms."""
import asyncio
import uuid
import logging
from celery import Task
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.tasks.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_async_session():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class DatabaseTask(Task):
    _session_factory = None

    @property
    def session_factory(self):
        if self._session_factory is None:
            self._session_factory = get_async_session()
        return self._session_factory


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    max_retries=3,
    default_retry_delay=60,
    name="contentflow.schedule_post",
)
def schedule_post(self, post_id: str):
    """Publish a post to all selected platforms."""
    asyncio.run(_publish_post(self, post_id))


async def _publish_post(task: Task, post_id: str):
    from app.models.post import Post, PostLog
    from app.models.account import Account
    from app.services.encryption import decrypt_credentials

    async with task.session_factory() as db:
        # Load post
        result = await db.execute(select(Post).where(Post.id == uuid.UUID(post_id)))
        post = result.scalar_one_or_none()
        if not post:
            logger.error(f"Post {post_id} not found")
            return

        post.status = "publishing"
        db.add(post)
        await db.commit()

        all_success = True

        for platform_entry in post.platforms:
            # platform_entry format: "platform:account_id"
            parts = platform_entry.split(":", 1)
            if len(parts) != 2:
                continue
            platform, account_id_str = parts

            result = await db.execute(select(Account).where(Account.id == uuid.UUID(account_id_str)))
            account = result.scalar_one_or_none()
            if not account:
                continue

            credentials = decrypt_credentials(account.credentials)
            external_id = None
            error_msg = None

            try:
                if platform == "telegram":
                    from app.services.telegram_service import send_post_to_telegram
                    external_id = await send_post_to_telegram(
                        bot_token=credentials.get("bot_token", ""),
                        channel_id=credentials.get("channel_id", ""),
                        caption=post.caption,
                        media_url=post.media_url,
                        media_type=post.media_type,
                    )
                elif platform == "instagram":
                    from app.services.instagram_service import post_to_instagram
                    external_id = await post_to_instagram(
                        access_token=credentials.get("access_token", ""),
                        account_id=credentials.get("account_id", ""),
                        caption=post.caption,
                        media_url=post.media_url,
                        media_type=post.media_type,
                    )
                elif platform == "tiktok":
                    from app.services.tiktok_service import post_to_tiktok
                    external_id = await post_to_tiktok(
                        access_token=credentials.get("access_token", ""),
                        open_id=credentials.get("open_id", ""),
                        caption=post.caption,
                        media_url=post.media_url,
                    )

                log = PostLog(
                    post_id=post.id,
                    account_id=account.id,
                    platform=platform,
                    status="success",
                    external_id=external_id,
                )
            except Exception as e:
                logger.exception(f"Failed to post to {platform}: {e}")
                error_msg = str(e)
                all_success = False
                log = PostLog(
                    post_id=post.id,
                    account_id=account.id,
                    platform=platform,
                    status="failed",
                    error_message=error_msg,
                )

            db.add(log)

        post.status = "published" if all_success else "failed"
        db.add(post)
        await db.commit()
        logger.info(f"Post {post_id} finished with status={post.status}")
