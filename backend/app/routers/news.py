"""V7 — Yangiliklar (news discovery).

User-facing news feed: browse recent articles from curated reliable sources
(by category or free-text topic) and turn any article into a ready-to-edit
post caption with one AI call. Listing is free (RSS only); caption generation
consumes AI credits like any other text generation.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.services import credit_service, news_service
from app.routers.ai_chat import _call_ai, DEFAULT_OLLAMA_MODEL

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class NewsItemOut(BaseModel):
    title: str
    summary: str
    source: str
    url: str
    published: datetime | None


class NewsListResponse(BaseModel):
    items: list[NewsItemOut]


class NewsCategoryOut(BaseModel):
    key: str
    label: str


class NewsPostRequest(BaseModel):
    title: str = Field(..., max_length=500)
    summary: str = Field(default="", max_length=2000)
    source: str = Field(default="", max_length=200)
    url: str = Field(default="", max_length=1000)
    platform: str = Field(default="instagram", max_length=30)
    language: str = Field(default="uz", max_length=10)


class NewsPostResponse(BaseModel):
    caption: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[NewsCategoryOut])
async def list_categories(current_user: User = Depends(get_current_user)):
    return [
        NewsCategoryOut(key=key, label=meta["label"])
        for key, meta in news_service.CATEGORIES.items()
    ]


@router.get("", response_model=NewsListResponse)
async def list_news(
    topic: str | None = Query(default=None, max_length=200),
    category: str | None = Query(default=None, max_length=30),
    limit: int = Query(default=12, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    """Recent articles for a category and/or free-text topic. Free (no credits)."""
    items = await news_service.fetch_news(topic=topic, limit=limit, category=category)
    return NewsListResponse(
        items=[
            NewsItemOut(
                title=it.title, summary=it.summary, source=it.source,
                url=it.url, published=it.published,
            )
            for it in items
        ]
    )


_LANG_NAMES = {"uz": "Uzbek", "ru": "Russian", "en": "English"}


@router.post("/generate-post", response_model=NewsPostResponse)
async def generate_post_from_news(
    data: NewsPostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Write a social-media caption grounded in the given news article."""
    await credit_service.consume(db, current_user, "caption")

    lang = _LANG_NAMES.get(data.language, "Uzbek")
    system = (
        "You are a social media copywriter. Write ONE engaging "
        f"{data.platform} post caption in {lang}, based STRICTLY on the news "
        "article the user provides. Rules:\n"
        "- Do not invent facts beyond the article.\n"
        "- Start with a hook line, keep it concise (under 150 words).\n"
        "- End with 3-5 relevant hashtags.\n"
        f"- Credit the source by name ({data.source or 'the outlet'}).\n"
        "- Output ONLY the caption text, no preamble or explanations."
    )
    article = f"Title: {data.title}\nSummary: {data.summary}\nSource: {data.source}\nURL: {data.url}"
    caption = await _call_ai(
        [{"role": "user", "content": article}], model=DEFAULT_OLLAMA_MODEL, system=system
    )
    return NewsPostResponse(caption=caption.strip())
