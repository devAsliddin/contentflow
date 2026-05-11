import uuid
from datetime import datetime
from pydantic import BaseModel


class AccountCredentials(BaseModel):
    # Telegram
    bot_token: str | None = None
    channel_id: str | None = None
    # Instagram / TikTok
    access_token: str | None = None
    account_id: str | None = None
    open_id: str | None = None


class ConnectAccountRequest(BaseModel):
    platform: str  # instagram | tiktok | telegram
    account_name: str
    credentials: AccountCredentials


class AccountOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    account_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
