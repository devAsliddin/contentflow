from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.schemas.ai_plan import (
    GeneratePlanRequest, WeeklyPlan,
    GenerateCaptionRequest, CaptionResponse, IdeasResponse
)
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import AIService

router = APIRouter()


@router.post("/generate-plan", response_model=WeeklyPlan)
async def generate_plan(
    data: GeneratePlanRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        service = AIService()
        plan = await service.generate_plan(
            niche=data.niche,
            frequency=data.frequency,
            tone=data.tone,
            platforms=data.platforms,
            language=data.language,
        )
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/generate-caption", response_model=CaptionResponse)
async def generate_caption(
    data: GenerateCaptionRequest,
    current_user: User = Depends(get_current_user),
):
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
    # Get recent posts for context
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
