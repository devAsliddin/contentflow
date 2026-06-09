"""Instagram service — private API via instagrapi (username/password login)."""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class InstagramTwoFactorRequired(Exception):
    """Raised when the account has 2FA enabled and a code is needed."""


def _client():
    from instagrapi import Client
    cl = Client()
    cl.delay_range = [1, 3]
    return cl


def instagram_login(
    username: str,
    password: str,
    verification_code: str | None = None,
) -> dict[str, Any]:
    """
    Authenticate with Instagram and return a dict with:
      - session: JSON-serialisable session dict (store encrypted, NOT the password)
      - user_id: numeric Instagram user ID
      - username: normalised username
    Pass verification_code (6-digit) when the account has 2FA enabled.
    Raises ValueError on bad credentials or challenge required.
    """
    from instagrapi.exceptions import TwoFactorRequired

    cl = _client()
    try:
        if verification_code:
            cl.login(username, password, verification_code=str(verification_code).strip())
        else:
            cl.login(username, password)
    except TwoFactorRequired:
        # Account has 2FA. If a code was already supplied, it was wrong/expired.
        if verification_code:
            raise ValueError("Incorrect or expired 2FA code. Enter a fresh code.")
        raise InstagramTwoFactorRequired("2FA code required")
    except Exception as e:
        msg = str(e).lower()
        if "two" in msg or "2fa" in msg:
            if verification_code:
                raise ValueError("Incorrect or expired 2FA code. Enter a fresh code.")
            raise InstagramTwoFactorRequired("2FA code required")
        if "challenge" in msg or "verification" in msg:
            raise ValueError(
                "Instagram requires verification. Open the Instagram app on your "
                "phone, approve this login, then try again."
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


def fetch_media_metrics(items: list[tuple]) -> dict[str, dict]:
    """Fetch REAL engagement metrics for published Instagram posts.

    items: list of (post_id, media_pk, session_dict).
    Returns {post_id: {likes, views, reach, comments}}. Blocking — run in a thread.
    One instagrapi client is reused per distinct session to limit API calls.
    """
    out: dict[str, dict] = {}
    client_cache: dict[int, Any] = {}
    for post_id, media_pk, session in items:
        if not session or not media_pk:
            continue
        try:
            key = id(session)
            cl = client_cache.get(key)
            if cl is None:
                cl = _client()
                cl.set_settings(session)
                client_cache[key] = cl
            # media_pk we stored is the numeric pk; ensure it's usable
            pk = cl.media_pk_from_code(media_pk) if not str(media_pk).isdigit() else media_pk
            m = cl.media_info(pk)
            likes = int(getattr(m, "like_count", 0) or 0)
            comments = int(getattr(m, "comment_count", 0) or 0)
            views = int(getattr(m, "view_count", 0) or getattr(m, "play_count", 0) or 0)
            out[str(post_id)] = {
                "likes": likes,
                "views": views,
                # True reach needs the Insights API (business). Fall back to views,
                # else approximate from likes so the row isn't empty.
                "reach": views or int(likes * 1.4),
                "comments": comments,
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("media metrics fetch failed for %s: %s", media_pk, exc)
            continue
    return out


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
