"""V6 — Image storage utilities.

Saves generated images to: {media_dir}/ai_generated/{user_id}/{job_id}.png
Returns the file path (relative media URL: /media/ai_generated/{user_id}/{job_id}.png).
"""
from __future__ import annotations

import logging
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


def save_generated_image(
    image_bytes: bytes,
    user_id: str,
    job_id: str,
) -> tuple[str, str]:
    """Write image bytes to disk.

    Returns:
        (file_path, media_url) where:
          - file_path  is the absolute filesystem path
          - media_url  is the URL served by the StaticFiles mount (/media/...)
    """
    settings = get_settings()
    dest_dir = Path(settings.media_dir) / "ai_generated" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{job_id}.png"
    file_path = dest_dir / file_name

    file_path.write_bytes(image_bytes)
    logger.debug("image saved: %s (%d bytes)", file_path, len(image_bytes))

    media_url = f"/media/ai_generated/{user_id}/{file_name}"
    return str(file_path), media_url
