"""V4 — Instagram OAuth connect for auto-reply (messaging + comments scopes).

Password is NEVER requested or stored. The user authorises on instagram.com and
we receive an access token, which is stored Fernet-encrypted (V2 logic).
"""
import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.middleware.auth_middleware import decode_token
from app.services.encryption import encrypt_credentials
from app.services import instagram_graph as ig
from app.redis_client import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

OAUTH_STATE_TTL = 600  # 10 minutes
INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize"
SCOPE = (
    "instagram_business_basic,"
    "instagram_business_manage_messages,"
    "instagram_business_manage_comments,"
    "instagram_business_manage_insights,"
    "instagram_business_content_publish"
)


def _redirect_uri() -> str:
    return (
        settings.instagram_oauth_redirect_uri
        or f"{settings.backend_url.rstrip('/')}/api/accounts/instagram/oauth/callback"
    )


@router.get("/oauth/start")
async def instagram_oauth_start(
    token: str = Query(..., description="Access token — passed in query for the top-level browser redirect"),
    db: AsyncSession = Depends(get_db),
):
    """Begin the Instagram OAuth flow — 302 redirect to instagram.com.

    Because this is a full-page navigation (window.location), the JWT can't be
    sent as an Authorization header, so it is passed as a query param and
    validated here exactly like get_current_user would.
    """
    import uuid as _uuid

    if not settings.instagram_login_app_id:
        raise HTTPException(status_code=500, detail="Instagram (Meta) app not configured")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    result = await db.execute(select(User).where(User.id == _uuid.UUID(payload["sub"])))
    current_user = result.scalar_one_or_none()
    if not current_user or not current_user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    state = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.setex(f"ig_autoreply:state:{state}", OAUTH_STATE_TTL, str(current_user.id))

    auth_url = (
        f"{INSTAGRAM_AUTH_URL}"
        f"?client_id={settings.instagram_login_app_id}"
        f"&redirect_uri={_redirect_uri()}"
        f"&response_type=code"
        f"&scope={SCOPE}"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/oauth/callback")
async def instagram_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle the OAuth callback, store the long-lived token, subscribe webhook."""
    import uuid as _uuid

    redis = get_redis()
    user_id = await redis.get(f"ig_autoreply:state:{state}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    await redis.delete(f"ig_autoreply:state:{state}")

    # code → short-lived → long-lived token
    short = await ig.exchange_code_for_token(code, _redirect_uri())
    short_token = short.get("access_token")
    if not short_token:
        raise HTTPException(status_code=400, detail="No access_token from Instagram")

    long = await ig.exchange_for_long_lived(short_token)
    access_token = long.get("access_token", short_token)

    me = await ig.get_me(access_token)
    ig_user_id = str(me.get("user_id") or short.get("user_id") or "")
    username = me.get("username") or f"instagram_{ig_user_id}"

    if not ig_user_id:
        raise HTTPException(status_code=400, detail="Could not resolve Instagram account id")

    # Try to auto-subscribe the webhook (best effort)
    subscribed = await ig.subscribe_webhook(ig_user_id, access_token)

    from datetime import datetime, timezone as _tz
    credentials = encrypt_credentials({
        "access_token": access_token,
        "ig_user_id": ig_user_id,
        "ig_username": username,
        "scopes": SCOPE,
        "token_issued_at": datetime.now(_tz.utc).isoformat(),
    })

    uid = _uuid.UUID(user_id)

    # Upsert: prefer matching an existing IG account by ig_user_id, then username.
    result = await db.execute(
        select(Account).where(
            Account.user_id == uid,
            Account.platform == "instagram",
            Account.ig_user_id == ig_user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        result = await db.execute(
            select(Account).where(
                Account.user_id == uid,
                Account.platform == "instagram",
                Account.account_name == username,
            )
        )
        account = result.scalar_one_or_none()

    if account:
        account.credentials = credentials
        account.account_name = username
        account.ig_user_id = ig_user_id
        account.ig_webhook_subscribed = subscribed
        account.is_active = True
    else:
        account = Account(
            user_id=uid,
            platform="instagram",
            account_name=username,
            credentials=credentials,
            ig_user_id=ig_user_id,
            ig_webhook_subscribed=subscribed,
        )
        db.add(account)

    await db.flush()
    logger.info(
        "Instagram (auto-reply) connected: user=%s ig=%s webhook=%s",
        user_id, username, subscribed,
    )

    # V5 — fire-and-forget initial analysis (must not delay or break the callback)
    try:
        from app.models.analysis import AnalysisJob  # noqa: PLC0415
        analysis_job = AnalysisJob(
            account_id=account.id,
            job_type="initial_analysis",
            status="queued",
            progress_pct=0,
        )
        db.add(analysis_job)
        await db.flush()
        try:
            from app.tasks.analysis_tasks import run_initial_analysis  # type: ignore[import]  # noqa: PLC0415
            run_initial_analysis.delay(str(account.id), str(analysis_job.id))
            logger.info("v5: initial_analysis enqueued account_id=%s job_id=%s", account.id, analysis_job.id)
        except Exception as celery_exc:  # noqa: BLE001
            logger.warning("v5: could not enqueue initial_analysis: %s", celery_exc)
    except Exception as trigger_exc:  # noqa: BLE001
        logger.warning("v5: initial_analysis trigger failed (callback not affected): %s", trigger_exc)

    return RedirectResponse(
        url=f"{settings.frontend_url}/dashboard/autoreply?connected=instagram"
    )
