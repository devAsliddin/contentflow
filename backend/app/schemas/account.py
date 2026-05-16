import uuid
from datetime import datetime
from pydantic import BaseModel


class AccountCredentials(BaseModel):
    # Telegram
    bot_token: str | None = None
    channel_id: str | None = None
    # Instagram (session-based)
    ig_session: dict | None = None
    ig_user_id: str | None = None
    # Instagram / TikTok (legacy Graph API)
    access_token: str | None = None
    account_id: str | None = None
    open_id: str | None = None


class InstagramLoginRequest(BaseModel):
    username: str
    password: str
    account_name: str | None = None  # display name; defaults to username


class ConnectAccountRequest(BaseModel):
    platform: str  # instagram | tiktok | telegram
    account_name: str
    credentials: AccountCredentials


class TelegramAddChannelRequest(BaseModel):
    channel_id: str
    label: str | None = None


class TelegramUpdateTokenRequest(BaseModel):
    bot_token: str


class TelegramChannelOut(BaseModel):
    id: uuid.UUID
    account_name: str
    channel_id: str
    created_at: datetime


class TelegramBotSettingsOut(BaseModel):
    bot_name: str | None = None
    bot_username: str | None = None
    bot_valid: bool
    channels: list[TelegramChannelOut]
    max_channels: int
    can_add: bool


class AccountOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    account_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
