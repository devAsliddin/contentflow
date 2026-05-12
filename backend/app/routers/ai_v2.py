"""AI V2 endpoints — caption rewriter and future AI features."""
import json
import logging
import re
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────────────────────────


class RewriteCaptionRequest(BaseModel):
    caption: str = Field(..., min_length=1, max_length=4096, description="Original caption to rewrite")
    target_platform: Literal["instagram", "tiktok", "telegram"] = Field(
        ..., description="Target platform style"
    )
    tone: str | None = Field(
        default=None,
        max_length=50,
        description="Desired tone: e.g. casual, professional, funny, motivational",
    )


class RewriteCaptionResponse(BaseModel):
    rewritten_caption: str
    platform: str
    char_count: int


class HashtagRequest(BaseModel):
    caption: str | None = Field(default=None, max_length=4096)
    topic: str | None = Field(default=None, max_length=255)
    target_platform: Literal["instagram", "tiktok", "telegram"] = "instagram"
    niche: str | None = Field(default=None, max_length=120)
    language: str = Field(default="uz", max_length=20)
    limit: int = Field(default=15, ge=3, le=30)


class HashtagSuggestion(BaseModel):
    tag: str
    kind: Literal["trending", "niche"]
    score: float = Field(..., ge=0, le=1)


class HashtagResponse(BaseModel):
    platform: str
    hashtags: list[str]
    trending: list[str]
    niche: list[str]
    suggestions: list[HashtagSuggestion]
    source: Literal["ai", "fallback"]


# ─── Platform style instructions ──────────────────────────────────────────────

_PLATFORM_INSTRUCTIONS: dict[str, str] = {
    "instagram": (
        "Rewrite this caption for Instagram. Make it engaging, conversational, and "
        "visually expressive. Add 5–10 relevant hashtags at the end. "
        "Keep the total length under 2200 characters. Use line breaks for readability. "
        "Emojis are encouraged."
    ),
    "tiktok": (
        "Rewrite this caption for TikTok. Keep it short, punchy, and use trending "
        "language and slang where appropriate. Add 3–5 trending hashtags. "
        "Maximum 2200 characters. Hook the viewer in the first line."
    ),
    "telegram": (
        "Rewrite this caption for a Telegram channel post. You may use Telegram-supported "
        "formatting (*bold*, _italic_, `code`). Write in a clear, informative style. "
        "Maximum 4096 characters. Emojis are acceptable but not required."
    ),
}

_PLATFORM_CHAR_LIMITS: dict[str, int] = {
    "instagram": 2200,
    "tiktok": 2200,
    "telegram": 4096,
}

_PLATFORM_TRENDING_TAGS: dict[str, list[str]] = {
    "instagram": ["#reels", "#instagood", "#explorepage", "#contentcreator", "#viral"],
    "tiktok": ["#fyp", "#foryou", "#tiktoktrend", "#viral", "#creator"],
    "telegram": ["#yangiliklar", "#kanal", "#foydali", "#tavsiya", "#uzbekistan"],
}

_STOPWORDS = {
    "and", "for", "from", "that", "this", "with", "your", "you", "the", "about",
    "uchun", "bilan", "ham", "yoki", "shu", "bu", "bir", "juda", "kabi", "dan",
}


def _strip_code_fence(content: str) -> str:
    content = content.strip()
    if not content.startswith("```"):
        return content
    parts = content.split("```")
    if len(parts) < 2:
        return content
    body = parts[1].strip()
    if body.startswith("json"):
        body = body[4:].strip()
    return body


def _parse_json_object(content: str) -> dict:
    content = _strip_code_fence(content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start:end + 1])
        raise


def _normalize_hashtag(tag: str) -> str | None:
    value = tag.strip().lower()
    if not value:
        return None
    if not value.startswith("#"):
        value = f"#{value}"
    value = re.sub(r"[^\w#]", "", value, flags=re.UNICODE)
    if len(value) <= 1:
        return None
    return value[:80]


def _dedupe_hashtags(tags: list[str], limit: int) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        normalized = _normalize_hashtag(tag)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


def _fallback_hashtags(data: HashtagRequest) -> tuple[list[str], list[str]]:
    text = " ".join(part for part in [data.topic, data.niche, data.caption] if part)
    words = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
    niche_tags = []
    for word in words:
        if len(word) < 3 or word in _STOPWORDS:
            continue
        niche_tags.append(f"#{word}")

    if data.niche:
        niche_tags.insert(0, f"#{data.niche}")
    if data.topic:
        niche_tags.insert(0, f"#{data.topic}")

    trending = _PLATFORM_TRENDING_TAGS[data.target_platform]
    niche = _dedupe_hashtags(niche_tags or ["#content", "#marketing", "#socialmedia"], data.limit)
    return trending, niche


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/rewrite-caption", response_model=RewriteCaptionResponse)
async def rewrite_caption(
    data: RewriteCaptionRequest,
    current_user: User = Depends(get_current_user),
):
    """V2-AI-001 — Rewrite a caption for a specific platform style using claude-haiku."""
    platform_instruction = _PLATFORM_INSTRUCTIONS[data.target_platform]
    char_limit = _PLATFORM_CHAR_LIMITS[data.target_platform]

    tone_clause = f" Write in a {data.tone} tone." if data.tone else ""

    system_prompt = (
        f"You are an expert social media copywriter specializing in {data.target_platform} content. "
        f"{platform_instruction}{tone_clause} "
        f"Return ONLY the rewritten caption text — no explanation, no preamble, no quotes around it."
    )

    user_prompt = f"Original caption:\n{data.caption}"

    try:
        service = AIService()
        response = await service.client.messages.create(
            model=service.haiku,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        rewritten = response.content[0].text.strip()

        # Hard-truncate if the model exceeded the platform limit (safety net)
        if len(rewritten) > char_limit:
            rewritten = rewritten[:char_limit]

        return RewriteCaptionResponse(
            rewritten_caption=rewritten,
            platform=data.target_platform,
            char_count=len(rewritten),
        )
    except Exception as e:
        logger.error("Caption rewrite failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Caption rewrite failed: {str(e)}")


@router.post("/hashtags", response_model=HashtagResponse)
async def suggest_hashtags(
    data: HashtagRequest,
    current_user: User = Depends(get_current_user),
):
    """V2-AI-002 - suggest trending-style and niche hashtags for a post."""
    if not data.caption and not data.topic:
        raise HTTPException(status_code=400, detail="caption or topic is required")

    context = "\n".join(
        part for part in [
            f"Topic: {data.topic}" if data.topic else "",
            f"Niche: {data.niche}" if data.niche else "",
            f"Caption: {data.caption}" if data.caption else "",
        ] if part
    )

    system_prompt = (
        "You are a social media hashtag strategist. Return valid JSON only. "
        "Suggest hashtags that are relevant, concise, and safe for the requested platform."
    )
    user_prompt = f"""Suggest hashtags for {data.target_platform}.
Language: {data.language}
Limit: {data.limit}

{context}

Return JSON in this exact shape:
{{
  "trending": ["#tag1", "#tag2"],
  "niche": ["#tag3", "#tag4"]
}}

Rules:
- trending: broad discoverability tags that fit the platform and content.
- niche: specific tags derived from the topic/caption/niche.
- no banned, misleading, adult, or spam hashtags.
- no explanations outside JSON."""

    source: Literal["ai", "fallback"] = "ai"
    try:
        service = AIService()
        response = await service.client.messages.create(
            model=service.haiku,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        parsed = _parse_json_object(response.content[0].text)
        trending = _dedupe_hashtags(parsed.get("trending", []), data.limit)
        niche = _dedupe_hashtags(parsed.get("niche", []), data.limit)
        if not trending or not niche:
            raise ValueError("AI response did not include both hashtag groups")
    except Exception as e:
        logger.warning("Hashtag AI suggestion failed, using fallback: %s", e)
        source = "fallback"
        trending, niche = _fallback_hashtags(data)

    hashtags = _dedupe_hashtags([*trending, *niche], data.limit)
    trending = _dedupe_hashtags(trending, data.limit)
    niche = _dedupe_hashtags(niche, data.limit)

    suggestions = [
        HashtagSuggestion(tag=tag, kind="trending", score=0.9)
        for tag in trending
        if tag in hashtags
    ] + [
        HashtagSuggestion(tag=tag, kind="niche", score=0.82)
        for tag in niche
        if tag in hashtags
    ]

    return HashtagResponse(
        platform=data.target_platform,
        hashtags=hashtags,
        trending=[tag for tag in trending if tag in hashtags],
        niche=[tag for tag in niche if tag in hashtags],
        suggestions=suggestions[:data.limit],
        source=source,
    )
