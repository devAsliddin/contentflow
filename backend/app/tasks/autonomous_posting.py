"""V7 — Autonomous daily content pipeline for a time-boxed unsupervised pilot
on a single account (@f1n_cs), per explicit user request: no human review per
post, full-auto for a fixed 5-6 day window.

Each run: fetches real AI/tech news (grounds the caption in actual sources —
no hallucinated claims), writes one Uzbek caption + hashtags via the LLM,
generates an accompanying image, and creates a Post row with
status="scheduled". Actual publishing is handled by the existing
recover_missed_posts (runs every 60s) → schedule_post pipeline — this task
does not publish directly.
"""
import logging
import uuid as _uuid
from datetime import date, datetime, timezone

from pydantic import BaseModel, Field

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Pilot scope — explicit, time-boxed per user request (2026-07-23).
AUTONOMOUS_ACCOUNT_ID = "e14eb61d-fff0-4d5d-9660-7cf8ba5426ea"  # @f1n_cs (instagram)
AUTONOMOUS_UNTIL = date(2026, 7, 29)


class _AutoPostResult(BaseModel):
    # min_length guards against a degenerate-but-schema-valid LLM response
    # (empty strings still satisfy a bare `str` type) — confirmed to happen
    # in testing: identical prompt returned empty fields on one call and a
    # full, good caption on the next. A fully-unsupervised pipeline must
    # reject that rather than publish an empty post.
    caption: str = Field(..., min_length=20)
    hashtags: list[str] = Field(default_factory=list)
    image_prompt: str = Field(..., min_length=5)


@celery_app.task(name="contentflow.autonomous_daily_post")
def autonomous_daily_post():
    import asyncio
    asyncio.run(_run())


async def _run():
    if date.today() > AUTONOMOUS_UNTIL:
        logger.info("autonomous_daily_post: pilot window ended (%s) — skipping", AUTONOMOUS_UNTIL)
        return

    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from sqlalchemy import select, String, cast
    from app.config import get_settings
    from app.models.account import Account
    from app.models.post import Post
    from app.services.news_service import fetch_news, build_sources_block
    from app.services.ai.json_utils import complete_json_validated
    from app.services.images.router import generate_image
    from app.services.images.storage import save_generated_image

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with factory() as db:
            account_id = _uuid.UUID(AUTONOMOUS_ACCOUNT_ID)
            result = await db.execute(select(Account).where(Account.id == account_id))
            account = result.scalar_one_or_none()
            if not account or not account.is_active:
                logger.warning("autonomous_daily_post: account %s not found/inactive", AUTONOMOUS_ACCOUNT_ID)
                return

            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            existing = await db.execute(
                select(Post).where(
                    Post.user_id == account.user_id,
                    cast(Post.platforms, String).ilike(f"%{AUTONOMOUS_ACCOUNT_ID}%"),
                    Post.created_at >= today_start,
                )
            )
            if existing.scalars().first():
                logger.info("autonomous_daily_post: already created a post today for %s — skipping", AUTONOMOUS_ACCOUNT_ID)
                return

            items = await fetch_news(category="ai", limit=5)
            sources_block = build_sources_block(items)
            if not sources_block:
                logger.warning("autonomous_daily_post: no news sources available today — skipping")
                return

            system = (
                "You are a social media manager for an Uzbek-language AI/tech news "
                "Instagram account (@f1n_cs). Write ONE Instagram caption in Uzbek "
                "(Latin script only, no Cyrillic) based ONLY on the real news sources "
                "given below — do not invent facts not present in the sources. "
                "Engaging, punchy, 2-4 short paragraphs, end with a question to drive "
                "comments. Also provide 5-8 relevant hashtags (without the # symbol) "
                "and an image_prompt: an English visual description for an image "
                "generator (no text/lettering/words in the image itself).\n"
                "Return ONLY JSON: "
                '{"caption": "...", "hashtags": ["...", "..."], "image_prompt": "..."}'
            )
            prompt = f"Real news sources:\n{sources_block}\n\nWrite the Instagram post now."

            # complete_json_validated already retries once + falls back to the
            # next provider on a Pydantic validation failure (including our
            # min_length constraints catching an empty/degenerate response —
            # confirmed to happen in testing). If every provider is exhausted
            # it raises RuntimeError; better to skip today's post than crash.
            try:
                ai_result: _AutoPostResult = await complete_json_validated(
                    "content",
                    system=system,
                    prompt=prompt,
                    schema=_AutoPostResult,
                    max_tokens=800,
                    temperature=0.6,
                )
            except Exception as exc:  # noqa: BLE001
                logger.error("autonomous_daily_post: caption generation failed, skipping today: %s", exc)
                return

            caption = ai_result.caption.strip()
            if ai_result.hashtags:
                caption += "\n\n" + " ".join(f"#{h.lstrip('#')}" for h in ai_result.hashtags)

            media_url = None
            try:
                img = await generate_image(
                    prompt=(
                        "Professional, high-quality tech/AI news photo for social media. "
                        f"No text, words or lettering anywhere. Theme: {ai_result.image_prompt[:180]}"
                    ),
                    width=1024,
                    height=1024,
                )
                _, media_url = save_generated_image(img.image_bytes, str(account.user_id), str(_uuid.uuid4()))
            except Exception as exc:  # noqa: BLE001
                logger.warning("autonomous_daily_post: image generation failed, posting without image: %s", exc)

            post = Post(
                user_id=account.user_id,
                caption=caption,
                platforms=[f"instagram:{AUTONOMOUS_ACCOUNT_ID}"],
                scheduled_at=datetime.now(timezone.utc),
                status="scheduled",
                media_url=media_url,
                media_type="image" if media_url else None,
                platform_options={"instagram": {"placement": "feed", "aspect_ratio": "1:1"}},
            )
            db.add(post)
            await db.commit()
            await db.refresh(post)
            logger.info(
                "autonomous_daily_post: created post %s for account %s (media=%s)",
                post.id, AUTONOMOUS_ACCOUNT_ID, bool(media_url),
            )
    finally:
        await engine.dispose()
