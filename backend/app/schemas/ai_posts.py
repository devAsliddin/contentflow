"""V6 — Pydantic schemas for AI Post Creator."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# Instagram-style content type shared by the AI post creator and the chat agent.
ContentType = Literal["post", "story", "reel"]


# ─── AI caption generation schemas (used with complete_json_validated) ────────

class CaptionVariant(BaseModel):
    caption: str
    description: str = ""
    hashtags: list[str] = Field(default_factory=list)
    cta: str = ""


class CaptionGenerationResult(BaseModel):
    """JSON schema returned by the content AI for caption generation."""
    variants: list[CaptionVariant] = Field(min_length=1)
    image_prompt_seed_idea: str = ""


class ImagePromptResult(BaseModel):
    """JSON schema returned by the content AI for image-prompt generation."""
    image_prompt: str


# ─── Request / Response schemas for API endpoints ─────────────────────────────

class GeneratePostRequest(BaseModel):
    account_id: uuid.UUID | None = None
    topic: str | None = None
    idea_from_recommendation_id: uuid.UUID | None = None
    platform_targets: list[str] = Field(default_factory=list)  # ["instagram:acc_id", ...]
    # Content format the user picked before generating (post / story / reel).
    content_type: ContentType = "post"
    # Whether the user wants an AI-generated image for this post.
    want_image: bool = True


class RegenerateCaptionRequest(BaseModel):
    feedback: str | None = None


class GenerateImageRequest(BaseModel):
    pass  # no extra params needed; uses draft's caption/image_prompt_seed_idea


class RegenerateImageRequest(BaseModel):
    style_hint: str | None = None


class SendToComposerRequest(BaseModel):
    pass  # no body needed


# ─── Response schemas ─────────────────────────────────────────────────────────

class CaptionVariantOut(BaseModel):
    caption: str
    description: str
    hashtags: list[str]
    cta: str

    model_config = {"from_attributes": True}


class AiPostDraftOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID | None
    source: str
    topic_input: str | None
    caption: str
    description: str | None
    hashtags: list[Any]
    image_job_id: uuid.UUID | None
    status: str
    generation_meta: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AiPostDraftListItem(BaseModel):
    id: uuid.UUID
    caption: str
    status: str
    image_job_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AiPostDraftListResponse(BaseModel):
    items: list[AiPostDraftListItem]
    total: int
    page: int
    page_size: int


class GenerateImageResponse(BaseModel):
    image_job_id: uuid.UUID


class ImageJobStatusResponse(BaseModel):
    id: uuid.UUID
    status: str  # queued | generating | done | failed
    image_url: str | None = None  # /media/ai_generated/... — only when done
    error_message: str | None = None
    provider: str | None = None  # not exposed to user (will be None in response)

    model_config = {"from_attributes": True}


class SendToComposerResponse(BaseModel):
    post_id: uuid.UUID
    draft_id: uuid.UUID
