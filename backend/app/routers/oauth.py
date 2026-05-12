"""OAuth2 flows for Instagram and TikTok — V2 endpoints."""
import secrets
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.middleware.auth_middleware import get_current_user
from app.services.encryption import encrypt_credentials
from app.redis_client import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

OAUTH_STATE_TTL = 600  # 10 minutes
MAX_ACCOUNTS_PER_PLATFORM = 3

# ─── Instagram ────────────────────────────────────────────────────────────────

INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_LONG_LIVED_URL = "https://graph.instagram.com/access_token"
INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v19.0"
INSTAGRAM_SCOPE = "instagram_basic,instagram_content_publish,pages_read_engagement"


@router.get("/instagram/authorize")
async def instagram_authorize(
    current_user: User = Depends(get_current_user),
):
    """Redirect to Instagram OAuth2 authorization URL."""
    if not settings.instagram_app_id:
        raise HTTPException(status_code=500, detail="Instagram app not configured")

    state = secrets.token_urlsafe(32)
    redis = get_redis()
    # Store state keyed by value so callback can verify; include user_id for account creation
    await redis.setex(f"oauth:state:{state}", OAUTH_STATE_TTL, str(current_user.id))

    redirect_uri = f"{settings.backend_url}/api/v2/oauth/instagram/callback"
    auth_url = (
        f"{INSTAGRAM_AUTH_URL}"
        f"?client_id={settings.instagram_app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={INSTAGRAM_SCOPE}"
        f"&response_type=code"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/instagram/callback")
async def instagram_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle Instagram OAuth2 callback, exchange code for long-lived token."""
    redis = get_redis()
    user_id = await redis.get(f"oauth:state:{state}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    # Consume the state to prevent replay
    await redis.delete(f"oauth:state:{state}")

    redirect_uri = f"{settings.backend_url}/api/v2/oauth/instagram/callback"

    # Exchange code for short-lived token
    async with httpx.AsyncClient(timeout=30) as client:
        token_resp = await client.post(
            INSTAGRAM_TOKEN_URL,
            data={
                "client_id": settings.instagram_app_id,
                "client_secret": settings.instagram_app_secret,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        if token_resp.status_code != 200:
            logger.error("Instagram short-lived token exchange failed: %s", token_resp.text)
            raise HTTPException(status_code=400, detail="Failed to exchange Instagram code for token")

        short_token_data = token_resp.json()
        short_lived_token = short_token_data.get("access_token")
        ig_user_id = short_token_data.get("user_id")

        if not short_lived_token or not ig_user_id:
            raise HTTPException(status_code=400, detail="Incomplete token response from Instagram")

        # Exchange for long-lived token (60 day)
        long_token_resp = await client.get(
            INSTAGRAM_LONG_LIVED_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.instagram_app_secret,
                "access_token": short_lived_token,
            },
        )
        if long_token_resp.status_code != 200:
            logger.error("Instagram long-lived token exchange failed: %s", long_token_resp.text)
            raise HTTPException(status_code=400, detail="Failed to get long-lived Instagram token")

        long_token_data = long_token_resp.json()
        access_token = long_token_data.get("access_token", short_lived_token)

        # Fetch account info
        me_resp = await client.get(
            f"{INSTAGRAM_GRAPH_URL}/me",
            params={"fields": "id,username", "access_token": access_token},
        )
        account_info = me_resp.json() if me_resp.status_code == 200 else {}
        username = account_info.get("username", f"instagram_{ig_user_id}")
        account_id = account_info.get("id", str(ig_user_id))

    # Enforce max 3 accounts per platform
    import uuid as _uuid
    uid = _uuid.UUID(user_id)
    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == uid,
            Account.platform == "instagram",
            Account.is_active == True,
        )
    )
    if count_result.scalar_one() >= MAX_ACCOUNTS_PER_PLATFORM:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ACCOUNTS_PER_PLATFORM} Instagram accounts already connected",
        )

    credentials = encrypt_credentials({
        "access_token": access_token,
        "account_id": account_id,
    })

    # Upsert: update existing inactive or create new
    existing_result = await db.execute(
        select(Account).where(
            Account.user_id == uid,
            Account.platform == "instagram",
            Account.account_name == username,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.credentials = credentials
        existing.is_active = True
        await db.flush()
        await db.refresh(existing)
        account = existing
    else:
        account = Account(
            user_id=uid,
            platform="instagram",
            account_name=username,
            credentials=credentials,
        )
        db.add(account)
        await db.flush()
        await db.refresh(account)

    logger.info("Instagram account connected: user=%s account=%s", user_id, username)

    # Redirect to frontend with success indicator
    return RedirectResponse(
        url=f"{settings.frontend_url}/accounts?connected=instagram&account={username}"
    )


# ─── TikTok ───────────────────────────────────────────────────────────────────

TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_SCOPE = "video.upload,video.list"


@router.get("/tiktok/authorize")
async def tiktok_authorize(
    current_user: User = Depends(get_current_user),
):
    """Redirect to TikTok OAuth2 authorization URL."""
    if not settings.tiktok_client_key:
        raise HTTPException(status_code=500, detail="TikTok app not configured")

    state = secrets.token_urlsafe(32)
    redis = get_redis()
    redirect_uri = f"{settings.backend_url}/api/v2/oauth/tiktok/callback"
    # Store user_id in state; code_verifier included for forward-compatibility
    code_verifier = secrets.token_urlsafe(48)
    await redis.setex(f"oauth:state:{state}", OAUTH_STATE_TTL, f"{current_user.id}:{code_verifier}")

    auth_url = (
        f"{TIKTOK_AUTH_URL}"
        f"?client_key={settings.tiktok_client_key}"
        f"&response_type=code"
        f"&scope={TIKTOK_SCOPE}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/tiktok/callback")
async def tiktok_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle TikTok OAuth2 callback, exchange code for access + refresh tokens."""
    redis = get_redis()
    state_value = await redis.get(f"oauth:state:{state}")
    if not state_value:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    await redis.delete(f"oauth:state:{state}")

    # Parse state value: "user_id:code_verifier" or just "user_id"
    parts = state_value.split(":", 1)
    user_id = parts[0]

    redirect_uri = f"{settings.backend_url}/api/v2/oauth/tiktok/callback"

    async with httpx.AsyncClient(timeout=30) as client:
        token_resp = await client.post(
            TIKTOK_TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_key": settings.tiktok_client_key,
                "client_secret": settings.tiktok_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        if token_resp.status_code != 200:
            logger.error("TikTok token exchange failed: %s", token_resp.text)
            raise HTTPException(status_code=400, detail="Failed to exchange TikTok code for token")

        token_data = token_resp.json()
        # TikTok wraps data under "data" key
        data = token_data.get("data", token_data)
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        open_id = data.get("open_id")

        if not access_token or not open_id:
            raise HTTPException(status_code=400, detail="Incomplete token response from TikTok")

        # Fetch user display name
        user_resp = await client.get(
            "https://open.tiktokapis.com/v2/user/info/",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"fields": "open_id,display_name"},
        )
        user_info = {}
        if user_resp.status_code == 200:
            user_info = user_resp.json().get("data", {}).get("user", {})

        display_name = user_info.get("display_name", f"tiktok_{open_id[:8]}")

    import uuid as _uuid
    uid = _uuid.UUID(user_id)

    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == uid,
            Account.platform == "tiktok",
            Account.is_active == True,
        )
    )
    if count_result.scalar_one() >= MAX_ACCOUNTS_PER_PLATFORM:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ACCOUNTS_PER_PLATFORM} TikTok accounts already connected",
        )

    credentials_dict = {
        "access_token": access_token,
        "open_id": open_id,
    }
    if refresh_token:
        credentials_dict["refresh_token"] = refresh_token

    encrypted = encrypt_credentials(credentials_dict)

    existing_result = await db.execute(
        select(Account).where(
            Account.user_id == uid,
            Account.platform == "tiktok",
            Account.account_name == display_name,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.credentials = encrypted
        existing.is_active = True
        await db.flush()
        await db.refresh(existing)
    else:
        account = Account(
            user_id=uid,
            platform="tiktok",
            account_name=display_name,
            credentials=encrypted,
        )
        db.add(account)
        await db.flush()

    logger.info("TikTok account connected: user=%s account=%s", user_id, display_name)

    return RedirectResponse(
        url=f"{settings.frontend_url}/accounts?connected=tiktok&account={display_name}"
    )
