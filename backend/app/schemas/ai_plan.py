from typing import Literal
from pydantic import BaseModel, Field

Platform = Literal[
    "instagram", "telegram", "tiktok",
    "facebook", "linkedin", "youtube", "twitter"
]

Tone = Literal["professional", "casual", "humorous", "educational", "inspirational"]


# ── Plan generation ───────────────────────────────────────────────────────────

class GeneratePlanRequest(BaseModel):
    niche: str
    tone: Tone = "casual"
    frequency: int = Field(default=1, ge=1, le=3)  # posts per platform per day
    platforms: list[str]
    language: str = "en"
    week_start: str = "Monday"  # ISO date or weekday name


class PlanPost(BaseModel):
    day: int                  # 0=Monday … 6=Sunday
    platform: str
    idea: str
    scheduled_time: str       # "HH:MM"


class WeeklyPlan(BaseModel):
    week_start: str
    posts: list[PlanPost]


# ── Caption batch ─────────────────────────────────────────────────────────────

class CaptionPostInput(BaseModel):
    day: int
    platform: str
    idea: str


class GenerateCaptionsRequest(BaseModel):
    niche: str
    tone: str
    posts: list[CaptionPostInput]


class CaptionItem(BaseModel):
    day: int
    platform: str
    idea: str
    caption: str
    hashtags: list[str] = Field(default_factory=list)


class CaptionsResponse(BaseModel):
    captions: list[CaptionItem]


# ── Single caption ────────────────────────────────────────────────────────────

class GenerateCaptionRequest(BaseModel):
    topic: str = ""
    platform: str
    tone: str
    language: str = "en"
    image_url: str | None = None  # relative URL like /media/filename.jpg


class CaptionResponse(BaseModel):
    caption: str
    hashtags: list[str]
    character_count: int


# ── Ideas ─────────────────────────────────────────────────────────────────────

class PostIdea(BaseModel):
    title: str
    description: str
    platform: str
    content_type: str  # image | video | text


class IdeasResponse(BaseModel):
    ideas: list[PostIdea]


# ── Legacy compat (keep old field names accepted as well) ─────────────────────

class DayPost(BaseModel):
    platform: str
    content_idea: str = ""
    caption_suggestion: str = ""
    hashtags: list[str] = Field(default_factory=list)
    best_time: str = "12:00"


class PlanDay(BaseModel):
    day: str
    posts: list[DayPost]
