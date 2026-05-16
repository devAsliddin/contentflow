import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.account import (
    ConnectAccountRequest,
    AccountOut,
    InstagramLoginRequest,
    TelegramAddChannelRequest,
    TelegramUpdateTokenRequest,
    TelegramBotSettingsOut,
    TelegramChannelOut,
)
from app.middleware.auth_middleware import get_current_user
from app.services.encryption import encrypt_credentials, decrypt_credentials

router = APIRouter()

MAX_ACCOUNTS_PER_PLATFORM = 3
MAX_TELEGRAM_CHANNELS = 5


def _platform_limit(platform: str) -> int:
    return MAX_TELEGRAM_CHANNELS if platform == "telegram" else MAX_ACCOUNTS_PER_PLATFORM


async def _get_owned_account(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _telegram_rows_for_bot(
    db: AsyncSession,
    user_id: uuid.UUID,
    bot_token: str,
) -> list[tuple[Account, dict]]:
    result = await db.execute(
        select(Account)
        .where(
            Account.user_id == user_id,
            Account.platform == "telegram",
            Account.is_active == True,
        )
        .order_by(Account.created_at.asc())
    )

    rows: list[tuple[Account, dict]] = []
    for account in result.scalars().all():
        credentials = decrypt_credentials(account.credentials)
        if credentials.get("bot_token") == bot_token:
            rows.append((account, credentials))
    return rows


async def _fetch_telegram_bot_info(bot_token: str) -> dict | None:
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
        result = resp.json()
    except Exception:
        return None

    if not result.get("ok"):
        return None
    return result.get("result") or {}


async def _telegram_settings_payload(
    db: AsyncSession,
    user_id: uuid.UUID,
    bot_token: str,
) -> TelegramBotSettingsOut:
    rows = await _telegram_rows_for_bot(db, user_id, bot_token)
    bot = await _fetch_telegram_bot_info(bot_token)

    channels = [
        TelegramChannelOut(
            id=account.id,
            account_name=account.account_name,
            channel_id=credentials.get("channel_id", ""),
            created_at=account.created_at,
        )
        for account, credentials in rows
    ]

    return TelegramBotSettingsOut(
        bot_name=(bot or {}).get("first_name"),
        bot_username=(bot or {}).get("username"),
        bot_valid=bot is not None,
        channels=channels,
        max_channels=MAX_TELEGRAM_CHANNELS,
        can_add=bot is not None and len(channels) < MAX_TELEGRAM_CHANNELS,
    )


async def _unique_account_name(db: AsyncSession, user_id: uuid.UUID, platform: str, base: str) -> str:
    result = await db.execute(
        select(Account.account_name).where(
            Account.user_id == user_id,
            Account.platform == platform,
        )
    )
    existing = set(result.scalars().all())
    if base not in existing:
        return base

    idx = 2
    while f"{base} {idx}" in existing:
        idx += 1
    return f"{base} {idx}"


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def connect_account(
    data: ConnectAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = _platform_limit(data.platform)
    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == current_user.id,
            Account.platform == data.platform,
            Account.is_active == True,
        )
    )
    count = count_result.scalar_one()
    if count >= limit:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {limit} {data.platform} accounts allowed",
        )

    encrypted = encrypt_credentials(data.credentials.model_dump(exclude_none=True))

    from datetime import datetime, timezone as tz
    account = Account(
        user_id=current_user.id,
        platform=data.platform,
        account_name=data.account_name,
        credentials=encrypted,
        oauth_migrated=True,
        oauth_migrated_at=datetime.now(tz.utc),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return AccountOut.model_validate(account)


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    platform: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
    if platform:
        query = query.where(Account.platform == platform)
    result = await db.execute(query)
    return [AccountOut.model_validate(a) for a in result.scalars().all()]


@router.patch("/{account_id}", response_model=AccountOut)
async def rename_account(
    account_id: uuid.UUID,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename (update display name of) an account."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    new_name = (data.get("account_name") or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="account_name is required")
    account.account_name = new_name
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return AccountOut.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)


@router.post("/instagram/login", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def instagram_login(
    data: InstagramLoginRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect Instagram account using username + password (instagrapi session)."""
    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == current_user.id,
            Account.platform == "instagram",
            Account.is_active == True,
        )
    )
    if count_result.scalar_one() >= MAX_ACCOUNTS_PER_PLATFORM:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ACCOUNTS_PER_PLATFORM} Instagram accounts allowed")

    from app.services.instagram_service import instagram_login as ig_login
    try:
        result = await __import__("asyncio").get_event_loop().run_in_executor(
            None, lambda: ig_login(data.username, data.password)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Instagram login error: {e}")

    credentials = {
        "ig_session": result["session"],
        "ig_user_id": result["user_id"],
    }
    encrypted = encrypt_credentials(credentials)

    from datetime import datetime, timezone as tz
    account = Account(
        user_id=current_user.id,
        platform="instagram",
        account_name=data.account_name or result["username"],
        credentials=encrypted,
        oauth_migrated=True,
        oauth_migrated_at=datetime.now(tz.utc),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return AccountOut.model_validate(account)


@router.post("/telegram/validate-token")
async def telegram_validate_token(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    """Validate a Telegram bot token and return bot info."""
    bot_token = (data.get("bot_token") or "").strip()
    if not bot_token:
        raise HTTPException(status_code=400, detail="bot_token is required")

    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
        result = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Telegram API unreachable: {e}")

    if not result.get("ok"):
        raise HTTPException(status_code=400, detail="Invalid bot token")

    bot = result["result"]
    return {
        "valid": True,
        "bot_id": bot.get("id"),
        "bot_name": bot.get("first_name"),
        "bot_username": bot.get("username"),
    }


@router.get("/telegram/{account_id}/settings", response_model=TelegramBotSettingsOut)
async def telegram_bot_settings(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_owned_account(db, current_user.id, account_id)
    if account.platform != "telegram":
        raise HTTPException(status_code=400, detail="Account is not Telegram")

    credentials = decrypt_credentials(account.credentials)
    bot_token = credentials.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Telegram bot token not found")

    return await _telegram_settings_payload(db, current_user.id, bot_token)


@router.post(
    "/telegram/{account_id}/channels",
    response_model=TelegramBotSettingsOut,
    status_code=status.HTTP_201_CREATED,
)
async def telegram_add_channel(
    account_id: uuid.UUID,
    data: TelegramAddChannelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = await _get_owned_account(db, current_user.id, account_id)
    if source.platform != "telegram":
        raise HTTPException(status_code=400, detail="Account is not Telegram")

    channel_id = data.channel_id.strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="channel_id is required")

    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == current_user.id,
            Account.platform == "telegram",
            Account.is_active == True,
        )
    )
    if count_result.scalar_one() >= MAX_TELEGRAM_CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_TELEGRAM_CHANNELS} Telegram channels allowed",
        )

    source_credentials = decrypt_credentials(source.credentials)
    bot_token = source_credentials.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Telegram bot token not found")
    if not await _fetch_telegram_bot_info(bot_token):
        raise HTTPException(
            status_code=400,
            detail="Bot token yaroqsiz yoki BotFather orqali yangilangan. Avval tokenni yangilang.",
        )

    rows = await _telegram_rows_for_bot(db, current_user.id, bot_token)
    for _, credentials in rows:
        if credentials.get("channel_id") == channel_id:
            raise HTTPException(status_code=400, detail="Channel already connected")

    try:
        from app.services.telegram_service import get_channel_info

        channel_info = await get_channel_info(bot_token, channel_id)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Kanal topilmadi yoki bot admin emas: {e}",
        )

    label = (data.label or "").strip()
    fallback_name = channel_info.get("title") or channel_info.get("username") or channel_id
    account_name = await _unique_account_name(
        db,
        current_user.id,
        "telegram",
        label or fallback_name,
    )

    account = Account(
        user_id=current_user.id,
        platform="telegram",
        account_name=account_name,
        credentials=encrypt_credentials({"bot_token": bot_token, "channel_id": channel_id}),
    )
    db.add(account)
    await db.flush()

    return await _telegram_settings_payload(db, current_user.id, bot_token)


@router.patch("/telegram/{account_id}/token", response_model=TelegramBotSettingsOut)
async def telegram_update_bot_token(
    account_id: uuid.UUID,
    data: TelegramUpdateTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = await _get_owned_account(db, current_user.id, account_id)
    if source.platform != "telegram":
        raise HTTPException(status_code=400, detail="Account is not Telegram")

    new_token = data.bot_token.strip()
    if not new_token:
        raise HTTPException(status_code=400, detail="bot_token is required")

    bot = await _fetch_telegram_bot_info(new_token)
    if not bot:
        raise HTTPException(status_code=400, detail="Bot token yaroqsiz")

    source_credentials = decrypt_credentials(source.credentials)
    old_token = source_credentials.get("bot_token")
    rows = await _telegram_rows_for_bot(db, current_user.id, old_token or "")
    if not rows:
        rows = [(source, source_credentials)]

    for account, credentials in rows:
        credentials["bot_token"] = new_token
        account.credentials = encrypt_credentials(credentials)
        db.add(account)

    await db.flush()
    return await _telegram_settings_payload(db, current_user.id, new_token)


@router.post("/{account_id}/verify")
async def verify_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    credentials = decrypt_credentials(account.credentials)

    if account.platform == "telegram":
        from app.services.telegram_service import verify_telegram_bot
        valid = await verify_telegram_bot(credentials.get("bot_token", ""))
    elif account.platform == "instagram":
        if credentials.get("ig_session"):
            from app.services.instagram_service import verify_instagram_session
            valid = await verify_instagram_session(credentials["ig_session"])
        else:
            from app.services.instagram_service import verify_instagram_token
            valid = await verify_instagram_token(credentials.get("access_token", ""))
    elif account.platform == "tiktok":
        from app.services.tiktok_service import verify_tiktok_token
        valid = await verify_tiktok_token(credentials.get("access_token", ""), credentials.get("open_id", ""))
    else:
        valid = False

    return {"valid": valid, "message": "Account verified" if valid else "Credentials invalid"}
