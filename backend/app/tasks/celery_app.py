from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "contentflow",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.post_tasks", "app.tasks.ai_tasks", "app.tasks.beat_tasks",
        "app.tasks.instagram_autoreply",
        "app.tasks.analysis_tasks",
        # V6 additions
        "app.tasks.image_tasks",
        "app.tasks.facebook_autoreply",
        "app.tasks.ai_reply",
    ],
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
    # V6: route image generation tasks to the dedicated 'images' queue
    task_routes={
        "contentflow.generate_image_task": {"queue": "images"},
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
        # V4: refresh Instagram long-lived tokens daily at 03:00 UTC
        "refresh-instagram-tokens": {
            "task": "contentflow.refresh_instagram_tokens",
            "schedule": crontab(hour=3, minute=0),
        },
        # V5: daily account metrics snapshot at 03:30 UTC (after token refresh at 03:00)
        "daily-account-snapshot": {
            "task": "contentflow.daily_account_snapshot",
            "schedule": crontab(hour=3, minute=30),
            "options": {"queue": "analysis"},
        },
        # V5: weekly full re-analysis every Monday at 04:00 UTC
        "weekly-analysis-refresh": {
            "task": "contentflow.weekly_refresh",
            "schedule": crontab(hour=4, minute=0, day_of_week="monday"),
            "options": {"queue": "analysis"},
        },
        # V6: FB Page token health check daily at 03:45 UTC (between IG refresh 03:00 and snapshot 03:30... actually after both)
        "fb-token-health-check": {
            "task": "contentflow.fb_token_health_check",
            "schedule": crontab(hour=3, minute=45),
        },
        # V6: clean up old discarded image jobs + files daily at 04:30 UTC
        "cleanup-old-image-jobs": {
            "task": "contentflow.cleanup_old_image_jobs",
            "schedule": crontab(hour=4, minute=30),
        },
    },
)
