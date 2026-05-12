"""AI V2 endpoints — caption rewriter and future AI features."""
import logging
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
