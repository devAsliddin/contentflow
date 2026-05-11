import uuid
from datetime import datetime
from pydantic import BaseModel


class CreatePostRequest(BaseModel):
    caption: str | None = None
    media_url: str | None = None
    media_type: str | None = None  # image | video
    platforms: list[str] = []
    scheduled_at: datetime | None = None


class UpdatePostRequest(BaseModel):
    caption: str | None = None
    media_url: str | None = None
    media_type: str | None = None
    platforms: list[str] | None = None
    scheduled_at: datetime | None = None
    status: str | None = None


class PostOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    caption: str | None
    media_url: str | None
    media_type: str | None
    platforms: list[str]
    scheduled_at: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
