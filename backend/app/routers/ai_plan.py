import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
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
    """Generate a caption — uses vision AI if image is provided, text AI otherwise."""
    try:
        service = AIService()

        if data.image_url:
            # Resolve the media file path from the URL (e.g. /media/foo.jpg)
            settings = get_settings()
            filename = os.path.basename(data.image_url.split("?")[0])
            image_path = os.path.join(settings.media_dir, filename)
            if not os.path.isfile(image_path):
                raise HTTPException(status_code=400, detail=f"Image not found on server: {filename}")
            result = await service.generate_caption_from_image(
                image_path=image_path,
                platform=data.platform,
                tone=data.tone,
                language=data.language,
            )
        else:
            result = await service.generate_caption(
                topic=data.topic or "content",
                platform=data.platform,
                tone=data.tone,
                language=data.language,
            )

        return result
    except HTTPException:
        raise
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
