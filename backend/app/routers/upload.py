import uuid
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import aiofiles

from app.config import get_settings
from app.models.user import User
from app.middleware.auth_middleware import get_current_user

router = APIRouter()
settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB

EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content_type = file.content_type or ""
    is_image = content_type in ALLOWED_IMAGE_TYPES
    is_video = content_type in ALLOWED_VIDEO_TYPES

    if not is_image and not is_video:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    contents = await file.read()
    size = len(contents)
    max_size = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE
    media_type = "image" if is_image else "video"

    if size > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large. Max size: {limit_mb}MB")

    ext = EXT_MAP.get(content_type, ".bin")
    filename = f"{uuid.uuid4()}{ext}"
    media_path = Path(settings.media_dir)
    media_path.mkdir(parents=True, exist_ok=True)
    file_path = media_path / filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    return {
        "url": f"/media/{filename}",
        "filename": filename,
        "media_type": media_type,
        "size_bytes": size,
    }
