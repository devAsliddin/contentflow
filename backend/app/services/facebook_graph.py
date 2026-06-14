"""V6 — Facebook Graph API client.

ONLY official Graph API calls. No ads/Marketing API — see scope list.
Tokens are Fernet-encrypted at rest; never logged here.
"""
import logging
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GraphAPIError(Exception):
    """Raised when a Facebook Graph API call returns a non-2xx or error JSON.

    `status_code` lets the caller decide whether to retry or give up.
    `fb_error_code` carries the inner Graph error code (e.g. 190 = invalid token).
    """
    def __init__(self, status_code: int | None, detail: str, fb_error_code: int | None = None):
        self.status_code = status_code
        self.detail = detail
        self.fb_error_code = fb_error_code
        super().__init__(f"[{status_code}] {detail}")


def _graph_base() -> str:
    return f"https://graph.facebook.com/{settings.fb_graph_version}"


def _check_graph_error(resp: httpx.Response) -> None:
    """Raise GraphAPIError if the response contains a Graph error or non-2xx status."""
    if resp.status_code != 200:
        try:
            body = resp.json()
            err = body.get("error", {})
            fb_code = err.get("code")
            message = err.get("message", resp.text)
        except Exception:
            fb_code = None
            message = resp.text
        raise GraphAPIError(resp.status_code, message, fb_error_code=fb_code)
    # Even 200 responses can carry an error block
    try:
        body = resp.json()
        if isinstance(body, dict) and "error" in body:
            err = body["error"]
            raise GraphAPIError(200, err.get("message", str(err)), fb_error_code=err.get("code"))
    except GraphAPIError:
        raise
    except Exception:
        pass


# ─── OAuth token exchange ──────────────────────────────────────────────────────

async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """Authorization code → short-lived user access token.

    Returns dict with at least 'access_token'.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_graph_base()}/oauth/access_token",
            params={
                "client_id": settings.fb_app_id_resolved,
                "client_secret": settings.fb_app_secret_resolved,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
    _check_graph_error(resp)
    return resp.json()


async def exchange_for_long_lived(short_lived_token: str) -> dict:
    """Short-lived user token → long-lived (60 day) user token.

    Returns dict with 'access_token' and 'expires_in'.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_graph_base()}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.fb_app_id_resolved,
                "client_secret": settings.fb_app_secret_resolved,
                "fb_exchange_token": short_lived_token,
            },
        )
    _check_graph_error(resp)
    return resp.json()


async def get_user_pages(user_access_token: str) -> list[dict]:
    """Fetch the list of Pages managed by the user.

    Returns list of dicts: {id, name, access_token, picture}.
    Raises GraphAPIError on failure.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_graph_base()}/me/accounts",
            params={
                "fields": "id,name,access_token,picture",
                "access_token": user_access_token,
            },
        )
    _check_graph_error(resp)
    body = resp.json()
    return body.get("data", [])


async def get_me(user_access_token: str) -> dict:
    """GET /me — returns {id, name}. Used for health-check / user-id retrieval."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_graph_base()}/me",
            params={"fields": "id,name", "access_token": user_access_token},
        )
    _check_graph_error(resp)
    return resp.json()


async def check_token(page_access_token: str) -> bool:
    """Best-effort token health check.

    Calls GET /me with the page token. Returns True if valid, False if error code 190
    (invalid/expired token). Re-raises other GraphAPIErrors.
    """
    try:
        await get_me(page_access_token)
        return True
    except GraphAPIError as exc:
        if exc.fb_error_code == 190:
            return False
        raise


async def subscribe_page_webhook(page_id: str, page_access_token: str) -> bool:
    """Subscribe the app to `feed` events for a Page.

    Best-effort: returns True on success, False if the call fails without raising.
    Logs a warning on failure so the OAuth flow is never blocked.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_graph_base()}/{page_id}/subscribed_apps",
                params={
                    "subscribed_fields": "feed",
                    "access_token": page_access_token,
                },
            )
        if resp.status_code == 200:
            body = resp.json()
            return bool(body.get("success", True))
        logger.warning("fb: webhook subscribe non-200 for page=%s status=%s body=%s",
                       page_id, resp.status_code, resp.text[:200])
    except Exception as exc:  # noqa: BLE001
        logger.warning("fb: webhook subscribe error for page=%s: %s", page_id, exc)
    return False


async def reply_to_comment(page_access_token: str, comment_id: str, message: str) -> dict:
    """Post a public reply under a Facebook comment.

    POST /{comment_id}/comments?message=...
    Raises GraphAPIError on failure.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_graph_base()}/{comment_id}/comments",
            params={"message": message, "access_token": page_access_token},
        )
    _check_graph_error(resp)
    return resp.json()
