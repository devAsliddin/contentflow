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


def _options_for(post, platform: str) -> dict:
    return (post.platform_options or {}).get(platform) or {}


def _public_media_url(media_url: str | None) -> str | None:
    if not media_url:
        return None
    if media_url.startswith("/media/"):
        return f"{settings.backend_url.rstrip('/')}{media_url}"
    return media_url


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
        processed_targets = 0
        results = []

        for platform_entry in post.platforms or []:
            # Current format: "platform:account_id". Older drafts may contain only account_id.
            account = None
            platform = "unknown"
            external_id = None
            error_msg = None

            try:
                entry = str(platform_entry)
                parts = entry.split(":", 1)
                if len(parts) == 2:
                    platform, account_id_str = parts
                else:
                    account_id_str = entry

                result = await db.execute(select(Account).where(Account.id == uuid.UUID(account_id_str)))
                account = result.scalar_one_or_none()
                if not account:
                    raise ValueError(f"Account not found: {account_id_str}")

                if platform == "unknown":
                    platform = account.platform
                if platform != account.platform:
                    raise ValueError(
                        f"Platform mismatch: target={platform}, account={account.platform}"
                    )

                try:
                    credentials = decrypt_credentials(account.credentials)
                except Exception as exc:
                    raise ValueError(
                        f"{account.account_name} credentials could not be opened. "
                        "Reconnect this account from Accounts."
                    ) from exc
                processed_targets += 1

                if platform == "telegram":
                    from pathlib import Path as _TGPath
                    from app.services.telegram_service import send_post_to_telegram
                    # Resolve /media/<filename> → absolute local path for multipart upload
                    tg_media_path = None
                    raw_url = post.media_url or ""
                    if raw_url.startswith("/media/"):
                        fname = raw_url[len("/media/"):]
                        tg_media_path = str(_TGPath(settings.media_dir).resolve() / fname)
                    external_id = await send_post_to_telegram(
                        bot_token=credentials.get("bot_token", ""),
                        channel_id=credentials.get("channel_id", ""),
                        caption=post.caption,
                        media_path=tg_media_path,
                        media_type=post.media_type,
                    )
                elif platform == "instagram":
                    import asyncio as _asyncio
                    from pathlib import Path as _Path
                    from app.services.instagram_service import post_to_instagram_session
                    ig_session = credentials.get("ig_session")
                    if not ig_session:
                        raise ValueError("Instagram session not found. Please reconnect the account.")
                    if not post.media_url or post.media_type not in ("image", "video"):
                        raise ValueError("Instagram requires an uploaded image or video.")
                    # Convert /media/<filename> URL to local filesystem path
                    raw_url = post.media_url or ""
                    if raw_url.startswith("/media/"):
                        filename = raw_url[len("/media/"):]
                        media_path = str(_Path(settings.media_dir) / filename)
                    else:
                        media_path = raw_url
                    placement = _options_for(post, "instagram").get("placement")
                    external_id = await _asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: post_to_instagram_session(
                            session=ig_session,
                            caption=post.caption,
                            media_path=media_path,
                            media_type=post.media_type,
                            placement=placement,
                        ),
                    )
                elif platform == "tiktok":
                    from app.services.tiktok_service import post_to_tiktok
                    if post.media_type != "video":
                        raise ValueError("TikTok only supports video posts.")
                    external_id = await post_to_tiktok(
                        access_token=credentials.get("access_token", ""),
                        open_id=credentials.get("open_id", ""),
                        caption=post.caption,
                        media_url=_public_media_url(post.media_url),
                    )

                log = PostLog(
                    post_id=post.id,
                    account_id=account.id,
                    platform=platform,
                    status="success",
                    external_id=external_id,
                )
                results.append(
                    {
                        "platform": platform,
                        "account_id": str(account.id),
                        "account_name": account.account_name,
                        "status": "success",
                        "external_id": external_id,
                    }
                )
            except Exception as e:
                logger.exception(f"Failed to post to {platform}: {e}")
                error_msg = str(e)
                all_success = False
                log = PostLog(
                    post_id=post.id,
                    account_id=account.id if account else None,
                    platform=platform,
                    status="failed",
                    error_message=error_msg,
                )
                results.append(
                    {
                        "platform": platform,
                        "account_id": str(account.id) if account else None,
                        "account_name": account.account_name if account else None,
                        "status": "failed",
                        "error": error_msg,
                    }
                )

            db.add(log)

        if processed_targets == 0:
            all_success = False

        post.status = "published" if all_success else "failed"
        db.add(post)
        await db.commit()
        logger.info(f"Post {post_id} finished with status={post.status}")

        # V2-NOT-001 / V2-NOT-002: send Telegram notification to the user's Telegram accounts
        try:
            await _notify_post_result(db, post, all_success, results)
        except Exception as notify_exc:
            logger.warning(f"Post notification failed (non-fatal): {notify_exc}")

        return {
            "post_id": post_id,
            "status": post.status,
            "success": all_success,
            "results": results,
        }


async def _notify_post_result(db, post, all_success: bool, results: list):
    """V2-NOT-001/002: Send publish result notification to the user's Telegram channel(s)."""
    from app.services.telegram_service import send_post_to_telegram
    from app.services.encryption import decrypt_credentials
    from app.models.account import Account

    tg_result = await db.execute(
        select(Account).where(
            Account.user_id == post.user_id,
            Account.platform == "telegram",
            Account.is_active == True,
        )
    )
    tg_accounts = tg_result.scalars().all()
    if not tg_accounts:
        return

    caption_preview = (post.caption or "No caption")[:80]
    platforms_str = ", ".join(str(r["platform"]).title() for r in results)

    if all_success:
        success_count = sum(1 for r in results if r.get("status") == "success")
        msg = (
            f"✅ Post muvaffaqiyatli joylandi!\n"
            f"📝 {caption_preview}...\n"
            f"📲 Platforms: {platforms_str}\n"
            f"✔️ {success_count} account(s) published"
        )
    else:
        error_summaries = []
        for r in results:
            if r.get("status") == "failed":
                error_summaries.append(f"• {r.get('platform', '?')}: {r.get('error', 'Unknown error')[:100]}")
        errors_text = "\n".join(error_summaries[:3]) or "Unknown error"
        msg = (
            f"❌ Post joylashda xato!\n"
            f"📝 {caption_preview}...\n"
            f"📲 Platforms: {platforms_str}\n"
            f"Xatolar:\n{errors_text}"
        )

    for tg_acc in tg_accounts:
        try:
            creds = decrypt_credentials(tg_acc.credentials)
            bot_token = creds.get("bot_token", "")
            channel_id = creds.get("channel_id", "")
            if bot_token and channel_id:
                await send_post_to_telegram(
                    bot_token=bot_token,
                    channel_id=channel_id,
                    caption=msg,
                )
        except Exception as e:
            logger.warning(f"Notification to Telegram account {tg_acc.id} failed: {e}")
