from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "contentflow",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.post_tasks", "app.tasks.ai_tasks", "app.tasks.beat_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_max_retries=3,
    task_default_retry_delay=60,
    # Redis broker transport options for reliability
    broker_transport_options={
        "visibility_timeout": 3600,  # 1 hour
        "max_retries": 5,
    },
    # Celery beat: recover missed scheduled posts every minute
    beat_schedule={
        "recover-missed-posts": {
            "task": "contentflow.recover_missed_posts",
            "schedule": 60.0,  # every 60 seconds
        },
        # V2-NOT-003: weekly analytics summary every Monday at 09:00 UTC
        "weekly-analytics-summary": {
            "task": "contentflow.weekly_analytics_summary",
            "schedule": crontab(hour=9, minute=0, day_of_week="monday"),
        },
    },
)
