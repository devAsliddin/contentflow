"""Async AI generation tasks."""
from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="contentflow.generate_plan_async")
def generate_plan_async(user_id: str, request_data: dict) -> dict:
    """Run AI plan generation in background."""
    import asyncio
    from app.services.ai_service import AIService
    return asyncio.run(AIService().generate_plan_async(request_data))
