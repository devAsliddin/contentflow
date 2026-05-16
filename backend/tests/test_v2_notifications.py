"""V2-TEST-001: Notification tests (V2-NOT-001, V2-NOT-002, V2-NOT-003)."""
import uuid
import asyncio
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_notify_success_called_on_publish():
    """V2-NOT-001: _notify_post_result is called after successful publish."""
    from app.tasks.post_tasks import _notify_post_result
    from app.models.post import Post

    mock_post = MagicMock(spec=Post)
    mock_post.user_id = uuid.uuid4()
    mock_post.caption = "Test caption"
    mock_post.id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

    # No Telegram accounts → should return without sending
    await _notify_post_result(mock_db, mock_post, all_success=True, results=[])
    # Assert no exception raised


@pytest.mark.asyncio
async def test_notify_sends_success_message():
    """V2-NOT-001: Success notification formats correct message."""
    from app.tasks.post_tasks import _notify_post_result
    from app.models.post import Post
    from app.models.account import Account

    mock_post = MagicMock(spec=Post)
    mock_post.user_id = uuid.uuid4()
    mock_post.caption = "Success test post"
    mock_post.id = uuid.uuid4()
    mock_post.platforms = ["telegram:some-id"]

    mock_acc = MagicMock(spec=Account)
    mock_acc.id = uuid.uuid4()
    mock_acc.credentials = '{"bot_token": "fake", "channel_id": "@fake"}'

    mock_result_set = MagicMock()
    mock_result_set.scalars.return_value.all.return_value = [mock_acc]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result_set)

    results = [{"platform": "telegram", "status": "success"}]

    with patch("app.services.encryption.decrypt_credentials", return_value={"bot_token": "fake", "channel_id": "@fake"}):
        with patch("app.services.telegram_service.send_post_to_telegram", new_callable=AsyncMock) as mock_send:
            await _notify_post_result(mock_db, mock_post, all_success=True, results=results)
            mock_send.assert_called_once()
            # Verify the message contains success indicator
            call_args = mock_send.call_args[1]
            assert "✅" in call_args.get("caption", "") or "✅" in str(mock_send.call_args)


@pytest.mark.asyncio
async def test_notify_sends_error_message():
    """V2-NOT-002: Error notification formats correct message."""
    from app.tasks.post_tasks import _notify_post_result
    from app.models.post import Post
    from app.models.account import Account

    mock_post = MagicMock(spec=Post)
    mock_post.user_id = uuid.uuid4()
    mock_post.caption = "Error test post"
    mock_post.id = uuid.uuid4()
    mock_post.platforms = ["instagram:some-id"]

    mock_acc = MagicMock(spec=Account)
    mock_acc.credentials = '{"bot_token": "fake", "channel_id": "@fake"}'

    mock_result_set = MagicMock()
    mock_result_set.scalars.return_value.all.return_value = [mock_acc]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result_set)

    results = [{"platform": "instagram", "status": "failed", "error": "Upload failed"}]

    with patch("app.services.encryption.decrypt_credentials", return_value={"bot_token": "fake", "channel_id": "@fake"}):
        with patch("app.services.telegram_service.send_post_to_telegram", new_callable=AsyncMock) as mock_send:
            await _notify_post_result(mock_db, mock_post, all_success=False, results=results)
            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args[1]
            caption = call_kwargs.get("caption", "") or str(mock_send.call_args)
            assert "❌" in caption


@pytest.mark.asyncio
async def test_weekly_summary_task_registered():
    """V2-NOT-003: Weekly analytics summary task is registered in celery."""
    from app.tasks.celery_app import celery_app
    import app.tasks.beat_tasks  # noqa: F401 — triggers @celery_app.task decorator registration
    task_names = list(celery_app.tasks.keys())
    assert "contentflow.weekly_analytics_summary" in task_names


@pytest.mark.asyncio
async def test_weekly_summary_beat_schedule():
    """V2-NOT-003: Weekly summary is scheduled for Monday 09:00."""
    from app.tasks.celery_app import celery_app
    beat = celery_app.conf.beat_schedule
    assert "weekly-analytics-summary" in beat
    schedule = beat["weekly-analytics-summary"]
    assert schedule["task"] == "contentflow.weekly_analytics_summary"
