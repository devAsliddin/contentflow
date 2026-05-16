"""V2 AI extensions: weekly plan v2 + A/B caption variants."""
import json
import logging
from datetime import datetime, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostLog
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── V2-AI-004: Weekly plan v2 ────────────────────────────────────────────────


class WeeklyPlanV2Request(BaseModel):
    niche: str = Field(..., min_length=1, max_length=255)
    frequency: int = Field(default=5, ge=1, le=21)
    tone: str = Field(default="casual", max_length=50)
    platforms: list[str] = Field(default=["instagram", "telegram"])
    language: str = Field(default="uz", max_length=20)
    include_best_times: bool = Field(default=True)


class WeeklyPlanV2Response(BaseModel):
    week_start: str
    days: list[dict]
    best_times: dict
    hashtag_suggestions: dict
    generated_at: str


@router.post("/generate-plan", response_model=WeeklyPlanV2Response)
async def generate_weekly_plan_v2(
    data: WeeklyPlanV2Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """V2-AI-004 — Generate enhanced weekly content plan with hashtags + best times.

    Uses claude-sonnet-4-20250514 for higher quality output.
    """
    # Gather posting history for best-time hints
    best_times: dict[str, str] = {}
    if data.include_best_times:
        try:
            result = await db.execute(
                select(PostLog, Post)
                .join(Post, PostLog.post_id == Post.id)
                .where(
                    Post.user_id == current_user.id,
                    PostLog.status == "success",
                )
            )
            rows = result.all()
            hour_by_platform: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
            for log, post in rows:
                ts = log.executed_at
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                for entry in (post.platforms or []):
                    plat = str(entry).split(":")[0]
                    hour_by_platform[plat][ts.hour] += 1

            for plat, hours in hour_by_platform.items():
                if hours:
                    best_hour = max(hours, key=lambda h: hours[h])
                    best_times[plat] = f"{best_hour:02d}:00"
        except Exception as exc:
            logger.warning("Best-time calculation failed: %s", exc)

    # Platform defaults if no history
    default_times = {
        "instagram": "18:00",
        "tiktok": "19:00",
        "telegram": "12:00",
    }
    for plat in data.platforms:
        if plat not in best_times:
            best_times[plat] = default_times.get(plat, "12:00")

    best_times_str = ", ".join(f"{p}: {t}" for p, t in best_times.items())

    system_prompt = (
        "You are an expert social media content strategist. "
        "Return valid JSON only — no markdown, no explanation."
    )

    user_prompt = f"""Create an enhanced weekly content plan for a {data.niche} content creator.

Parameters:
- Posts per week: {data.frequency}
- Tone: {data.tone}
- Platforms: {', '.join(data.platforms)}
- Language: {data.language}
- Best posting times (based on history): {best_times_str}

Return JSON in this exact structure:
{{
  "week_start": "Monday",
  "days": [
    {{
      "day": "Monday",
      "posts": [
        {{
          "platform": "instagram",
          "content_idea": "...",
          "caption_suggestion": "...",
          "hashtags": ["#tag1", "#tag2", "#tag3"],
          "best_time": "18:00",
          "media_type": "image",
          "hook": "First line to grab attention"
        }}
      ]
    }}
  ],
  "hashtag_suggestions": {{
    "instagram": ["#tag1", "#tag2"],
    "telegram": ["#tag3"]
  }}
}}

Rules:
- Distribute {data.frequency} posts across the week
- Only include days that have posts
- Use the provided best posting times
- Generate relevant hashtags per platform
- Make content ideas specific and actionable
- Write captions in {data.language} language
- Vary content types (educational, entertaining, promotional)"""

    try:
        service = AIService()
        response = await service.client.messages.create(
            model=service.sonnet,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text.strip()
        if content.startswith("```"):
            parts = content.split("```")
            content = parts[1] if len(parts) > 1 else content
            if content.startswith("json"):
                content = content[4:].strip()
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("Weekly plan JSON parse error: %s", exc)
        raise HTTPException(status_code=500, detail="AI response parsing failed")
    except Exception as exc:
        logger.error("Weekly plan generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {exc}")

    return WeeklyPlanV2Response(
        week_start=parsed.get("week_start", "Monday"),
        days=parsed.get("days", []),
        best_times=best_times,
        hashtag_suggestions=parsed.get("hashtag_suggestions", {}),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ─── V2-AI-005: A/B caption variants ─────────────────────────────────────────


class ABCaptionRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    platform: str = Field(default="instagram", max_length=50)
    tone: str = Field(default="casual", max_length=50)
    language: str = Field(default="uz", max_length=20)
    variants: int = Field(default=3, ge=2, le=5)
    existing_caption: str | None = Field(default=None, max_length=4096)


class ABVariant(BaseModel):
    label: str
    caption: str
    char_count: int
    hashtags: list[str]
    hook: str
    rationale: str


class ABCaptionResponse(BaseModel):
    topic: str
    platform: str
    variants: list[ABVariant]
    recommendation: str


@router.post("/ab-captions", response_model=ABCaptionResponse)
async def generate_ab_captions(
    data: ABCaptionRequest,
    current_user: User = Depends(get_current_user),
):
    """V2-AI-005 — Generate 2-5 A/B caption variants using claude-haiku."""
    labels = ["A", "B", "C", "D", "E"][:data.variants]

    existing_clause = ""
    if data.existing_caption:
        existing_clause = f"\nExisting caption to improve upon:\n{data.existing_caption}\n"

    system_prompt = (
        "You are an expert social media copywriter specializing in A/B testing captions. "
        "Return valid JSON only — no markdown, no explanation."
    )

    user_prompt = f"""Generate {data.variants} distinct A/B caption variants for a {data.platform} post.

Topic: {data.topic}
Platform: {data.platform}
Tone: {data.tone}
Language: {data.language}
{existing_clause}
Return JSON in this exact structure:
{{
  "variants": [
    {{
      "label": "A",
      "caption": "The full caption text",
      "hashtags": ["#tag1", "#tag2"],
      "hook": "First line only",
      "rationale": "Why this variant works"
    }}
  ],
  "recommendation": "Which variant to test first and why"
}}

Rules:
- Each variant must use a DIFFERENT approach (e.g., question-led, story-led, data-led, humor-led)
- Write in {data.language} language
- Keep platform {data.platform} character limits
- Hashtags should be platform-appropriate
- Make rationale concise (1-2 sentences)
- Labels must be {', '.join(labels)}"""

    try:
        service = AIService()
        response = await service.client.messages.create(
            model=service.haiku,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text.strip()
        if content.startswith("```"):
            parts = content.split("```")
            content = parts[1] if len(parts) > 1 else content
            if content.startswith("json"):
                content = content[4:].strip()
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("A/B captions JSON parse error: %s", exc)
        raise HTTPException(status_code=500, detail="AI response parsing failed")
    except Exception as exc:
        logger.error("A/B captions generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {exc}")

    variants = []
    for v in parsed.get("variants", []):
        caption_text = v.get("caption", "")
        variants.append(ABVariant(
            label=v.get("label", "A"),
            caption=caption_text,
            char_count=len(caption_text),
            hashtags=v.get("hashtags", []),
            hook=v.get("hook", caption_text[:80]),
            rationale=v.get("rationale", ""),
        ))

    return ABCaptionResponse(
        topic=data.topic,
        platform=data.platform,
        variants=variants,
        recommendation=parsed.get("recommendation", "Test variant A first."),
    )
