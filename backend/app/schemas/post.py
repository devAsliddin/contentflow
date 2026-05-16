import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PlatformPublishOptions(BaseModel):
    placement: Literal["feed", "reel", "story", "post"] | None = None
    aspect_ratio: Literal["1:1", "4:5", "16:9", "9:16"] | None = None


class CreatePostRequest(BaseModel):
    caption: str | None = None
    media_url: str | None = None
    media_type: str | None = None  # image | video
    platforms: list[str] = []
    platform_options: dict[str, PlatformPublishOptions] = Field(default_factory=dict)
    scheduled_at: datetime | None = None


class UpdatePostRequest(BaseModel):
    caption: str | None = None
    media_url: str | None = None
    media_type: str | None = None
    platforms: list[str] | None = None
    platform_options: dict[str, PlatformPublishOptions] | None = None
    scheduled_at: datetime | None = None
    status: str | None = None


class PostReviewTarget(BaseModel):
    platform: str
    account_id: str | None = None
    account_name: str | None = None
    status: Literal["ready", "blocked"]
    placement: str | None = None
    aspect_ratio: str | None = None
    notes: list[str] = Field(default_factory=list)


class PostReviewOut(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    targets: list[PostReviewTarget] = Field(default_factory=list)


class PostOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    caption: str | None
    media_url: str | None
    media_type: str | None
    platforms: list[str]
    platform_options: dict[str, PlatformPublishOptions] = Field(default_factory=dict)
    scheduled_at: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
