"""V5 — Pydantic schemas for analysis endpoints and AI outputs."""
from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# StatsSummary (returned by GET /analysis/stats)
# ---------------------------------------------------------------------------

class HourScore(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Monday … 6=Sunday")
    hour: int = Field(..., ge=0, le=23)
    avg_er: float
    posts: int


class FormatScore(BaseModel):
    media_type: str  # IMAGE | VIDEO | CAROUSEL_ALBUM | REELS
    avg_er: float
    post_count: int


class HashtagScore(BaseModel):
    hashtag: str
    avg_er: float
    post_count: int


class TopPost(BaseModel):
    media_item_id: uuid.UUID
    ig_media_id: str
    permalink: str | None
    posted_at: datetime
    engagement_rate: float
    er_basis: Literal["reach", "followers"]


class DateValue(BaseModel):
    date: date
    value: float


class StatsSummary(BaseModel):
    period_days: int
    total_posts: int
    avg_engagement_rate: float
    best_posting_hours: list[HourScore]
    format_performance: list[FormatScore]
    top_hashtags: list[HashtagScore]
    top_posts: list[TopPost]
    worst_posts: list[TopPost]
    follower_trend: list[DateValue]
    posting_frequency_per_week: float


# ---------------------------------------------------------------------------
# AccountProfileSchema — §4.4 (AI output, stored in account_profiles.profile_json)
# ---------------------------------------------------------------------------

class ToneOfVoice(BaseModel):
    primary: str
    description: str
    emoji_usage: Literal["none", "light", "heavy"]


class ContentPillar(BaseModel):
    name: str
    share_pct: float = Field(..., ge=0, le=100)
    performance: Literal["strong", "average", "weak"]


class AudiencePortrait(BaseModel):
    summary: str
    likely_interests: list[str]


class AccountProfileSchema(BaseModel):
    niche: str
    sub_niches: list[str] = Field(default_factory=list)
    tone_of_voice: ToneOfVoice
    content_pillars: list[ContentPillar] = Field(default_factory=list)
    audience_portrait: AudiencePortrait
    language_strategy: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    summary_one_liner: str


# ---------------------------------------------------------------------------
# RecommendationsSchema — §4.5 (AI output, stored in ai_recommendations)
# ---------------------------------------------------------------------------

class PostingScheduleItem(BaseModel):
    day: str  # monday, tuesday, etc.
    hour: int = Field(..., ge=0, le=23)
    reason: str


class GrowthAction(BaseModel):
    action: str
    priority: Literal["high", "medium", "low"]
    expected_impact: str


class RecommendationsSchema(BaseModel):
    posting_schedule: list[PostingScheduleItem] = Field(default_factory=list)
    format_advice: str
    content_ideas_directions: list[str] = Field(default_factory=list)
    hashtag_advice: str
    growth_actions: list[GrowthAction] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# CaptionClassification — per-caption AI output (Celery chunk processing)
# ---------------------------------------------------------------------------

class CaptionClassification(BaseModel):
    index: int
    topic: str
    tone: Literal["professional", "friendly", "humorous", "inspirational", "salesy", "informative"]
    has_cta: bool
    language: Literal["uz", "ru", "en", "mixed"]


# ---------------------------------------------------------------------------
# ContentIdea — content-ideas endpoint output item
# ---------------------------------------------------------------------------

class ContentIdea(BaseModel):
    title: str
    caption_draft: str
    format: Literal["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS"]
    hashtags: list[str] = Field(default_factory=list)


class ContentIdeasResponse(BaseModel):
    ideas: list[ContentIdea]


# ---------------------------------------------------------------------------
# API response schemas
# ---------------------------------------------------------------------------

class AnalysisJobOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    job_type: str
    status: str
    progress_pct: int
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None

    model_config = {"from_attributes": True}


class StartAnalysisResponse(BaseModel):
    job_id: uuid.UUID
    status: str


class ContentIdeasRequest(BaseModel):
    count: int = Field(..., ge=1, le=5)
    topic_hint: str | None = None
