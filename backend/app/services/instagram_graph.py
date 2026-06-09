"""V4 — Instagram Graph API (Messaging) client.

ONLY official Graph API calls. No password login, no Selenium/Playwright, no
userbot. Connection is OAuth-token based; tokens are decrypted from `accounts`.
"""
import logging
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GraphAPIError(Exception):
    """Raised when a Graph API call returns a non-2xx response.

    `status_code` lets the caller decide whether to retry (5xx/network) or give
    up (4xx — permission, 24h window, invalid recipient, etc.).
    """
    def __init__(self, status_code: int | None, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"[{status_code}] {detail}")


def _graph_base() -> str:
    return f"https://graph.instagram.com/{settings.instagram_graph_version}"


# ─── OAuth token exchange ──────────────────────────────────────────────────────

async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """Authorization code → short-lived token. Returns {access_token, user_id}."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": settings.meta_app_id_resolved,
                "client_secret": settings.meta_app_secret_resolved,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, f"code exchange failed: {resp.text}")
    return resp.json()


async def exchange_for_long_lived(short_lived_token: str) -> dict:
    """Short-lived → long-lived (60 day) token. Returns {access_token, expires_in}."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://graph.instagram.com/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.meta_app_secret_resolved,
                "access_token": short_lived_token,
            },
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, f"long-lived exchange failed: {resp.text}")
    return resp.json()


async def refresh_long_lived(long_lived_token: str) -> dict:
    """Refresh a long-lived token (extends another 60 days)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://graph.instagram.com/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": long_lived_token},
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, f"token refresh failed: {resp.text}")
    return resp.json()


async def get_me(access_token: str) -> dict:
    """Fetch {user_id, username} for the connected professional account."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://graph.instagram.com/me",
            params={"fields": "user_id,username", "access_token": access_token},
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, f"me lookup failed: {resp.text}")
    return resp.json()


async def subscribe_webhook(ig_user_id: str, access_token: str) -> bool:
    """Subscribe the app to messages + comments for this IG account.

    Best-effort: returns True on success, False otherwise (never raises so OAuth
    callback still completes).
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_graph_base()}/{ig_user_id}/subscribed_apps",
                params={
                    "subscribed_fields": "messages,comments",
                    "access_token": access_token,
                },
            )
        if resp.status_code == 200:
            return True
        logger.warning("webhook subscribe failed for %s: %s", ig_user_id, resp.text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("webhook subscribe error for %s: %s", ig_user_id, exc)
    return False


# ─── Reply sending ─────────────────────────────────────────────────────────────

async def send_dm(access_token: str, recipient_ig_id: str, text: str) -> dict:
    """Send a Direct Message to a user (by their IG-scoped id)."""
    return await _post_message(
        access_token,
        {"recipient": {"id": recipient_ig_id}, "message": {"text": text}},
    )


async def send_private_reply(access_token: str, comment_id: str, text: str) -> dict:
    """Send a private DM in response to a comment (recipient = comment_id)."""
    return await _post_message(
        access_token,
        {"recipient": {"comment_id": comment_id}, "message": {"text": text}},
    )


async def _post_message(access_token: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_graph_base()}/me/messages",
            params={"access_token": access_token},
            json=body,
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, resp.text)
    return resp.json()


async def reply_to_comment(access_token: str, comment_id: str, text: str) -> dict:
    """Post a public reply under a comment."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_graph_base()}/{comment_id}/replies",
            params={"message": text, "access_token": access_token},
        )
    if resp.status_code != 200:
        raise GraphAPIError(resp.status_code, resp.text)
    return resp.json()
