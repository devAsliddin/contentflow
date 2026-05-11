from pydantic import BaseModel


class GeneratePlanRequest(BaseModel):
    niche: str
    frequency: int  # posts per week
    tone: str  # professional | casual | humorous | educational
    platforms: list[str]
    language: str = "en"


class DayPost(BaseModel):
    platform: str
    content_idea: str
    caption_suggestion: str
    hashtags: list[str]
    best_time: str


class PlanDay(BaseModel):
    day: str
    posts: list[DayPost]


class WeeklyPlan(BaseModel):
    week_start: str
    days: list[PlanDay]


class GenerateCaptionRequest(BaseModel):
    topic: str
    platform: str
    tone: str
    language: str = "en"


class CaptionResponse(BaseModel):
    caption: str
    hashtags: list[str]
    character_count: int


class PostIdea(BaseModel):
    title: str
    description: str
    platform: str
    content_type: str  # image | video | text


class IdeasResponse(BaseModel):
    ideas: list[PostIdea]
