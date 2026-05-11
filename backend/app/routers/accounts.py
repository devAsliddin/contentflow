import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.schemas.account import ConnectAccountRequest, AccountOut
from app.middleware.auth_middleware import get_current_user
from app.services.encryption import encrypt_credentials, decrypt_credentials

router = APIRouter()

MAX_ACCOUNTS_PER_PLATFORM = 3


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def connect_account(
    data: ConnectAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce max 3 accounts per platform
    count_result = await db.execute(
        select(func.count()).where(
            Account.user_id == current_user.id,
            Account.platform == data.platform,
            Account.is_active == True,
        )
    )
    count = count_result.scalar_one()
    if count >= MAX_ACCOUNTS_PER_PLATFORM:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ACCOUNTS_PER_PLATFORM} {data.platform} accounts allowed",
        )

    encrypted = encrypt_credentials(data.credentials.model_dump(exclude_none=True))

    account = Account(
        user_id=current_user.id,
        platform=data.platform,
        account_name=data.account_name,
        credentials=encrypted,
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
        from app.services.instagram_service import verify_instagram_token
        valid = await verify_instagram_token(credentials.get("access_token", ""))
    elif account.platform == "tiktok":
        from app.services.tiktok_service import verify_tiktok_token
        valid = await verify_tiktok_token(credentials.get("access_token", ""), credentials.get("open_id", ""))
    else:
        valid = False

    return {"valid": valid, "message": "Account verified" if valid else "Credentials invalid"}
