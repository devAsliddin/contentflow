"""QA — AI agent post creation: media attachment + publishable platform targets."""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from sqlalchemy import select

import app.routers.ai_agent as ai_agent
from app.models.account import Account
from app.models.post import Post


AGENT_URL = "/api/v2/ai/agent-chat"


@pytest.fixture
async def ig_account(db, test_user):
    acc = Account(
        id=uuid.uuid4(),
        user_id=test_user.id,
        platform="instagram",
        account_name="dev_asliddin",
        credentials='{"ig_session": {"a": 1}}',
        is_active=True,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


@pytest.mark.asyncio
async def test_agent_attaches_media_and_builds_publishable_target(
    async_client: AsyncClient, db, test_user, ig_account
):
    """The uploaded file is attached and 'instagram' becomes 'instagram:<account_id>'."""
    action_json = (
        '{"action": "create_post", "caption": "Ready for Monday", '
        '"platforms": ["instagram"], "scheduled_at": "2026-06-15T18:00:00"}'
    )
    with patch.object(ai_agent, "_call_ollama", AsyncMock(return_value=action_json)):
        resp = await async_client.post(AGENT_URL, json={
            "messages": [{"role": "user", "content": "schedule this for Monday 18:00"}],
            "media_url": "/media/ready.jpg",
            "media_type": "image",
        })
    assert resp.status_code == 200, resp.text

    post = (await db.execute(
        select(Post).where(Post.user_id == test_user.id).order_by(Post.created_at.desc())
    )).scalars().first()
    assert post is not None
    assert post.media_url == "/media/ready.jpg"
    assert post.media_type == "image"
    # platform name was upgraded to a publishable "platform:account_id" target
    assert post.platforms == [f"instagram:{ig_account.id}"]
    assert post.status == "scheduled"
    assert post.scheduled_at is not None


@pytest.mark.asyncio
async def test_agent_post_without_media_is_allowed(
    async_client: AsyncClient, db, test_user, ig_account
):
    """Text-only post creation still works (media is optional)."""
    action_json = (
        '{"action": "create_post", "caption": "No media", "platforms": ["instagram"]}'
    )
    with patch.object(ai_agent, "_call_ollama", AsyncMock(return_value=action_json)):
        resp = await async_client.post(AGENT_URL, json={
            "messages": [{"role": "user", "content": "draft a post"}],
        })
    assert resp.status_code == 200
    post = (await db.execute(
        select(Post).where(Post.user_id == test_user.id).order_by(Post.created_at.desc())
    )).scalars().first()
    assert post.media_url is None
    assert post.platforms == [f"instagram:{ig_account.id}"]
