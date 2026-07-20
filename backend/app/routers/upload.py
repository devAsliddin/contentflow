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

# Magic bytes signatures: list of (offset, expected_bytes)
# All listed signatures must match for the file to be considered valid.
_MAGIC: dict[str, list[tuple[int, bytes]]] = {
    "image/jpeg":      [(0, b"\xff\xd8\xff")],
    "image/png":       [(0, b"\x89PNG\r\n\x1a\n")],
    "image/webp":      [(0, b"RIFF"), (8, b"WEBP")],
    "video/mp4":       [(4, b"ftyp")],
    "video/quicktime": [(4, b"ftyp")],
}
# Alternative box types accepted for QuickTime/MOV
_QT_ALT_BOXES = [b"moov", b"mdat", b"wide", b"skip", b"pnot"]


def _validate_magic(content: bytes, content_type: str) -> bool:
    """Return True if file content matches expected magic bytes for the declared type."""
    if len(content) < 12:
        return False
    checks = _MAGIC.get(content_type)
    if not checks:
        return False
    valid = all(content[off:off + len(sig)] == sig for off, sig in checks)
    if not valid and content_type == "video/quicktime":
        valid = any(content[4:8] == box for box in _QT_ALT_BOXES)
    return valid


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

    if not _validate_magic(contents, content_type):
        raise HTTPException(status_code=400, detail="File content does not match declared type")

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
