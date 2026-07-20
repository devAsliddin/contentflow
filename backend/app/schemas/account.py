import re
import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator


def _strip_html(value: str) -> str:
    return re.sub(r'<[^>]+>', '', value)


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
    verification_code: str | None = None  # 6-digit 2FA code, if 2FA is enabled

    @field_validator("account_name")
    @classmethod
    def sanitize_account_name(cls, v: str | None) -> str | None:
        return _strip_html(v).strip() if v is not None else None


class ConnectAccountRequest(BaseModel):
    platform: str  # instagram | tiktok | telegram
    account_name: str
    credentials: AccountCredentials

    @field_validator("account_name")
    @classmethod
    def sanitize_account_name(cls, v: str) -> str:
        return _strip_html(v).strip()


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
    # V4 — populated only for Instagram accounts connected for auto-reply.
    ig_user_id: str | None = None
    ig_webhook_subscribed: bool = False

    model_config = {"from_attributes": True}
