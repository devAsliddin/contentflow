from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.schemas.ai_plan import (
    GeneratePlanRequest, WeeklyPlan,
    GenerateCaptionsRequest, CaptionsResponse,
    GenerateCaptionRequest, CaptionResponse,
    IdeasResponse,
)
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import AIService

router = APIRouter()


@router.post("/generate-plan", response_model=WeeklyPlan)
async def generate_plan(
    data: GeneratePlanRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a full weekly content plan for all selected platforms."""
    try:
        service = AIService()
        plan = await service.generate_plan(
            niche=data.niche,
            frequency=data.frequency,
            tone=data.tone,
            platforms=data.platforms,
            language=data.language,
            week_start=data.week_start,
        )
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/generate-captions", response_model=CaptionsResponse)
async def generate_captions(
    data: GenerateCaptionsRequest,
    current_user: User = Depends(get_current_user),
):
    """Batch caption generation — one AI call for all posts in the plan."""
    try:
        service = AIService()
        posts_input = [
            {"day": p.day, "platform": p.platform, "idea": p.idea}
            for p in data.posts
        ]
        result = await service.generate_captions_batch(
            niche=data.niche,
            tone=data.tone,
            posts=posts_input,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption batch generation failed: {str(e)}")


@router.post("/generate-caption", response_model=CaptionResponse)
async def generate_caption(
    data: GenerateCaptionRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a single caption — used for per-post regeneration."""
    try:
        service = AIService()
        result = await service.generate_caption(
            topic=data.topic,
            platform=data.platform,
            tone=data.tone,
            language=data.language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")


@router.post("/suggest-ideas", response_model=IdeasResponse)
async def suggest_ideas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Suggest 5 post ideas based on recent publishing history."""
    result = await db.execute(
        select(Post)
        .where(Post.user_id == current_user.id, Post.status == "published")
        .order_by(Post.created_at.desc())
        .limit(10)
    )
    recent_posts = [{"caption": p.caption} for p in result.scalars().all()]

    try:
        service = AIService()
        ideas = await service.suggest_ideas(recent_posts)
        return ideas
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ideas generation failed: {str(e)}")
