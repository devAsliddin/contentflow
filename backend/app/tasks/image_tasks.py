"""V6 — Celery: async image generation task.

Task:
    generate_image_task(image_job_id: str)  — queue='images'

Flow:
    1. Load ImageJob from DB; set status='generating'.
    2. Call generate_image(prompt, width, height, seed) via ImageRouter.
    3. Save bytes to disk via storage.save_generated_image.
    4. Update ImageJob: status='done', file_path, provider, model, finished_at.
    5. On any error: status='failed', error_message.

Async-in-Celery pattern (asyncio.run) — identical to instagram_autoreply.py.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.tasks.celery_app import celery_app
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _session_factory():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@celery_app.task(
    name="contentflow.generate_image_task",
    queue="images",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def generate_image_task(self, image_job_id: str):
    """Generate an image for the given image_job_id.

    Queued in the 'images' queue. Uses asyncio.run() per V5 pattern.
    """
    asyncio.run(_generate_image_async(image_job_id))


async def _generate_image_async(image_job_id: str) -> None:
    from app.models.ai_posts import ImageJob
    from app.services.images.router import generate_image
    from app.services.images.storage import save_generated_image

    try:
        job_uuid = uuid.UUID(image_job_id)
    except ValueError:
        logger.error("image_task: invalid image_job_id=%r", image_job_id)
        return

    engine, factory = _session_factory()
    try:
        # ── Load job ──────────────────────────────────────────────────────────
        async with factory() as db:
            result = await db.execute(
                select(ImageJob).where(ImageJob.id == job_uuid)
            )
            job = result.scalar_one_or_none()
            if not job:
                logger.warning("image_task: ImageJob %s not found — skipping", image_job_id)
                return

            # Mark as generating
            job.status = "generating"
            db.add(job)
            await db.commit()

            # Capture values we need outside the session
            prompt = job.image_prompt
            width = job.width
            height = job.height
            user_id = str(job.user_id)

        # ── Generate image ────────────────────────────────────────────────────
        try:
            result_obj = await generate_image(
                prompt=prompt,
                width=width,
                height=height,
                seed=None,  # random seed for variety
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "image_task: generation failed job_id=%s error=%s", image_job_id, exc
            )
            async with factory() as db:
                result = await db.execute(
                    select(ImageJob).where(ImageJob.id == job_uuid)
                )
                job = result.scalar_one_or_none()
                if job:
                    job.status = "failed"
                    job.error_message = str(exc)[:1000]
                    job.finished_at = datetime.now(timezone.utc)
                    db.add(job)
                    await db.commit()
            return

        # ── Save to disk ──────────────────────────────────────────────────────
        try:
            file_path, _media_url = save_generated_image(
                image_bytes=result_obj.image_bytes,
                user_id=user_id,
                job_id=image_job_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "image_task: storage failed job_id=%s error=%s", image_job_id, exc
            )
            async with factory() as db:
                result = await db.execute(
                    select(ImageJob).where(ImageJob.id == job_uuid)
                )
                job = result.scalar_one_or_none()
                if job:
                    job.status = "failed"
                    job.error_message = f"Storage error: {str(exc)[:900]}"
                    job.finished_at = datetime.now(timezone.utc)
                    db.add(job)
                    await db.commit()
            return

        # ── Update job as done ────────────────────────────────────────────────
        async with factory() as db:
            result = await db.execute(
                select(ImageJob).where(ImageJob.id == job_uuid)
            )
            job = result.scalar_one_or_none()
            if not job:
                logger.warning("image_task: ImageJob %s disappeared after generation", image_job_id)
                return

            job.status = "done"
            job.file_path = file_path
            job.provider = result_obj.provider
            job.model = result_obj.model
            job.finished_at = datetime.now(timezone.utc)
            # width/height already set from creation, but update in case provider returned different
            db.add(job)
            await db.commit()

        logger.info(
            "image_task: done job_id=%s provider=%s latency_ms=%d",
            image_job_id, result_obj.provider, result_obj.latency_ms,
        )

    finally:
        await engine.dispose()
