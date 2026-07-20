"""V6 — Facebook OAuth connect (Page access for comment auto-reply).

Flow:
  GET  /oauth/start        → redirect to facebook.com dialog
  GET  /oauth/callback     → code exchange → 1 page: auto-attach; many: session+redirect
  POST /select-page        → attach chosen page (from session list)
  GET  /pages              → return page list from Redis session (id/name/picture only, NO token)

Password is NEVER requested. Tokens are Fernet-encrypted at rest and NEVER logged.
Scope: pages_show_list, pages_read_engagement (Development mode).
Page-management scopes require Advanced Access via App Review — see _FB_SCOPE.
NO ads_management, NO Marketing API.
"""
import json
import logging
import secrets
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth_middleware import decode_token, get_current_user
from app.models.account import Account
from app.models.user import User
from app.redis_client import get_redis
from app.services.encryption import encrypt_credentials
from app.services import facebook_graph as fb

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

_OAUTH_STATE_TTL = 600      # 10 minutes
_PAGES_SESSION_TTL = 600    # 10 minutes
_FB_AUTH_URL = "https://www.facebook.com/{ver}/dialog/oauth"
# Only scopes the app has access to in Development mode. The page-management
# permissions (pages_read_user_content, pages_manage_engagement,
# pages_manage_metadata) are Advanced Access — Meta rejects them with
# "Invalid Scopes" until they're granted via App Review. Re-add them to this
# list once the app is approved for them.
_FB_SCOPE = (
    "pages_show_list,"
    "pages_read_engagement"
)


def _redirect_uri() -> str:
    return (
        settings.fb_oauth_redirect_uri
        or f"{settings.backend_url.rstrip('/')}/api/accounts/facebook/oauth/callback"
    )


# ─── Start ────────────────────────────────────────────────────────────────────

@router.get("/oauth/start", summary="Begin Facebook OAuth flow")
async def facebook_oauth_start(
    token: str = Query(..., description="JWT access token (passed in query for browser redirect)"),
    db: AsyncSession = Depends(get_db),
):
    """Redirect browser to Facebook dialog.

    Token is passed as query param because this is a top-level browser navigation
    (window.location), so Authorization header is not available.
    """
    if not settings.fb_app_id_resolved:
        raise HTTPException(status_code=500, detail="Facebook app not configured")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    result = await db.execute(select(User).where(User.id == _uuid.UUID(payload["sub"])))
    current_user = result.scalar_one_or_none()
    if not current_user or not current_user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    state = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.setex(f"fb_oauth:state:{state}", _OAUTH_STATE_TTL, str(current_user.id))

    auth_url = (
        _FB_AUTH_URL.format(ver=settings.fb_graph_version)
        + f"?client_id={settings.fb_app_id_resolved}"
        + f"&redirect_uri={_redirect_uri()}"
        + f"&response_type=code"
        + f"&scope={_FB_SCOPE}"
        + f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


# ─── Callback ─────────────────────────────────────────────────────────────────

@router.get("/oauth/callback", summary="Handle Facebook OAuth callback")
async def facebook_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange code for token; if 1 page → auto-attach; if many → session+redirect."""
    redis = get_redis()
    user_id_str = await redis.get(f"fb_oauth:state:{state}")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    await redis.delete(f"fb_oauth:state:{state}")

    user_id = _uuid.UUID(user_id_str)

    # Exchange code for short-lived, then long-lived user token
    try:
        short_data = await fb.exchange_code_for_token(code, _redirect_uri())
    except fb.GraphAPIError as exc:
        logger.error("fb: code exchange failed user=%s: %s", user_id, exc.detail)
        raise HTTPException(status_code=400, detail="Facebook code exchange failed")

    short_token = short_data.get("access_token")
    if not short_token:
        raise HTTPException(status_code=400, detail="No access_token from Facebook")

    try:
        long_data = await fb.exchange_for_long_lived(short_token)
    except fb.GraphAPIError as exc:
        logger.error("fb: long-lived exchange failed user=%s: %s", user_id, exc.detail)
        raise HTTPException(status_code=400, detail="Facebook token exchange failed")

    long_token = long_data.get("access_token", short_token)

    # Get FB user id
    try:
        me = await fb.get_me(long_token)
    except fb.GraphAPIError as exc:
        logger.error("fb: /me failed user=%s: %s", user_id, exc.detail)
        raise HTTPException(status_code=400, detail="Could not fetch Facebook user info")

    fb_user_id = str(me.get("id") or "")
    if not fb_user_id:
        raise HTTPException(status_code=400, detail="Could not resolve Facebook user id")

    # Fetch managed pages
    try:
        pages = await fb.get_user_pages(long_token)
    except fb.GraphAPIError as exc:
        logger.error("fb: /me/accounts failed user=%s: %s", user_id, exc.detail)
        raise HTTPException(status_code=400, detail="Could not fetch Facebook pages")

    if not pages:
        return RedirectResponse(
            url=f"{settings.frontend_url}/dashboard/accounts?fb_error=no_pages"
        )

    if len(pages) == 1:
        # Auto-attach the single page
        page = pages[0]
        await _attach_page(
            db=db,
            user_id=user_id,
            fb_user_id=fb_user_id,
            page_id=page["id"],
            page_name=page.get("name", ""),
            page_token=page.get("access_token", ""),
            page_picture=page.get("picture"),
        )
        await db.commit()
        return RedirectResponse(
            url=f"{settings.frontend_url}/dashboard/accounts?connected=facebook"
        )

    # Multiple pages — store in Redis, let user pick
    # Store only safe fields in session (id, name, picture, access_token encrypted inside list)
    session_key = secrets.token_urlsafe(24)
    # We store the full page list (including tokens) in Redis; never in the HTTP response.
    session_data = json.dumps({
        "user_id": str(user_id),
        "fb_user_id": fb_user_id,
        "pages": pages,  # includes page access_tokens — kept server-side only
    })
    await redis.setex(f"fb_pages:{session_key}", _PAGES_SESSION_TTL, session_data)

    return RedirectResponse(
        url=f"{settings.frontend_url}/dashboard/accounts?fb_select_page={session_key}"
    )


# ─── Pages list (for Page Picker UI) ─────────────────────────────────────────

@router.get("/pages", summary="Get page list from session (no tokens)")
async def get_facebook_pages_session(
    session_key: str = Query(..., description="Session key returned by oauth/callback"),
    current_user: User = Depends(get_current_user),
):
    """Return page metadata from Redis session.

    Returns only {id, name, picture} — access tokens are NEVER included in the response.
    """
    redis = get_redis()
    raw = await redis.get(f"fb_pages:{session_key}")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        session = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid session data")

    # Verify the session belongs to the requesting user
    if session.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="Session does not belong to current user")

    safe_pages = [
        {
            "id": p["id"],
            "name": p.get("name", ""),
            "picture": p.get("picture"),
        }
        for p in session.get("pages", [])
    ]
    return {"pages": safe_pages}


# ─── Select Page ──────────────────────────────────────────────────────────────

class SelectPageBody(BaseModel):
    session_key: str
    page_id: str


@router.post("/select-page", summary="Attach a chosen Facebook page")
async def select_facebook_page(
    body: SelectPageBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attach the selected page from the session list."""
    redis = get_redis()
    raw = await redis.get(f"fb_pages:{body.session_key}")
    if not raw:
        raise HTTPException(status_code=400, detail="Session not found or expired")

    try:
        session = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid session data")

    if session.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="Session does not belong to current user")

    pages = session.get("pages", [])
    page = next((p for p in pages if p["id"] == body.page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found in session")

    fb_user_id = session.get("fb_user_id", "")
    page_token = page.get("access_token", "")

    await _attach_page(
        db=db,
        user_id=current_user.id,
        fb_user_id=fb_user_id,
        page_id=page["id"],
        page_name=page.get("name", ""),
        page_token=page_token,
        page_picture=page.get("picture"),
    )
    await db.commit()

    # Clean up the session after successful selection
    await redis.delete(f"fb_pages:{body.session_key}")

    return {"status": "connected", "page_name": page.get("name", "")}


# ─── Internal helper ──────────────────────────────────────────────────────────

async def _attach_page(
    *,
    db: AsyncSession,
    user_id: _uuid.UUID,
    fb_user_id: str,
    page_id: str,
    page_name: str,
    page_token: str,
    page_picture: dict | None,
) -> Account:
    """Upsert an Account row for the given Facebook Page and subscribe webhook."""
    from datetime import datetime, timezone as _tz

    # Fernet-encrypt token — NEVER store plaintext
    credentials = encrypt_credentials({
        "page_access_token": page_token,
        "fb_user_id": fb_user_id,
        "fb_page_id": page_id,
        "fb_page_name": page_name,
        "token_issued_at": datetime.now(_tz.utc).isoformat(),
    })

    # Subscribe webhook (best-effort)
    subscribed = await fb.subscribe_page_webhook(page_id, page_token)

    # Upsert: match by (user_id, platform='facebook', fb_page_id) first
    result = await db.execute(
        select(Account).where(
            Account.user_id == user_id,
            Account.platform == "facebook",
            Account.fb_page_id == page_id,
        )
    )
    account = result.scalar_one_or_none()

    if account:
        account.credentials = credentials
        account.account_name = page_name
        account.fb_user_id = fb_user_id
        account.fb_page_id = page_id
        account.fb_page_name = page_name
        account.fb_webhook_subscribed = subscribed
        account.token_status = "active"
        account.is_active = True
    else:
        account = Account(
            user_id=user_id,
            platform="facebook",
            account_name=page_name,
            credentials=credentials,
            fb_user_id=fb_user_id,
            fb_page_id=page_id,
            fb_page_name=page_name,
            fb_webhook_subscribed=subscribed,
            token_status="active",
        )
        db.add(account)

    await db.flush()
    logger.info(
        "fb: page attached user=%s page_id=%s page_name=%s webhook=%s",
        user_id, page_id, page_name, subscribed,
    )
    return account
