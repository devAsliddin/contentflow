"""Instagram service — private API via instagrapi (username/password login)."""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _client():
    from instagrapi import Client
    cl = Client()
    cl.delay_range = [1, 3]
    return cl


def instagram_login(username: str, password: str) -> dict[str, Any]:
    """
    Authenticate with Instagram and return a dict with:
      - session: JSON-serialisable session dict (store encrypted, NOT the password)
      - user_id: numeric Instagram user ID
      - username: normalised username
    Raises ValueError on bad credentials or challenge required.
    """
    cl = _client()
    try:
        cl.login(username, password)
    except Exception as e:
        msg = str(e).lower()
        if "challenge" in msg or "two" in msg or "2fa" in msg or "verification" in msg:
            raise ValueError(
                "Instagram requires 2-factor verification. "
                "Approve the login from your phone, then try again."
            )
        if "bad_password" in msg or "incorrect" in msg or "invalid" in msg:
            raise ValueError("Incorrect username or password.")
        raise ValueError(f"Instagram login failed: {e}")

    session = cl.get_settings()
    user_id = str(cl.user_id)
    return {"session": session, "user_id": user_id, "username": cl.username}


def post_to_instagram_session(
    session: dict,
    caption: str | None,
    media_path: str,
    media_type: str | None,
    placement: str | None = None,
) -> str:
    """Post photo or video using a stored session. Returns media ID."""
    cl = _client()
    cl.set_settings(session)
    # Re-login silently to refresh if needed
    try:
        cl.get_timeline_feed()
    except Exception:
        raise ValueError("Instagram session expired. Please reconnect the account.")

    caption = caption or ""
    path = Path(media_path)
    if not path.is_file():
        raise FileNotFoundError(f"Instagram media file not found: {media_path}")

    if media_type == "video":
        if placement == "story":
            media = cl.video_upload_to_story(path, caption=caption)
        elif placement == "feed":
            media = cl.video_upload(path, caption=caption)
        else:
            media = cl.clip_upload(path, caption=caption)
    elif placement == "story":
        media = cl.photo_upload_to_story(path, caption=caption)
    else:
        media = cl.photo_upload(path, caption=caption)

    media_id = (
        getattr(media, "pk", None)
        or getattr(media, "id", None)
        or getattr(media, "code", None)
        or "unknown"
    )
    return str(media_id)


async def verify_instagram_session(session_json: str) -> bool:
    """Verify a stored session is still valid."""
    try:
        session = json.loads(session_json) if isinstance(session_json, str) else session_json
        cl = _client()
        cl.set_settings(session)
        cl.get_timeline_feed()
        return True
    except Exception as e:
        logger.error(f"Instagram session verify failed: {e}")
        return False


# ── Legacy Graph-API helpers (kept for backwards compat) ────────────────────

import httpx

GRAPH_API = "https://graph.instagram.com/v19.0"


async def verify_instagram_token(access_token: str) -> bool:
    """Verify Instagram Graph API access token (legacy)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GRAPH_API}/me",
                params={"fields": "id,username", "access_token": access_token},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Instagram token verify failed: {e}")
        return False
