"""V2-TEST-001: Workflow endpoint tests (V2-WF-001 through V2-WF-005, V2-ACC-003)."""
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch

from app.models.post import Post
from app.models.user import User
from app.models.account import Account


# ─── V2-WF-001: Draft listing ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_drafts(async_client: AsyncClient, test_post: Post):
    """V2-WF-001: GET /api/v1/posts?status=draft returns draft posts."""
    response = await async_client.get("/api/v1/posts", params={"status": "draft"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    draft_ids = [p["id"] for p in data]
    assert str(test_post.id) in draft_ids


# ─── V2-WF-002: Status transitions ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_transition_draft_to_pending(async_client: AsyncClient, test_post: Post):
    """V2-WF-002: draft → pending_review transition."""
    with patch("app.routers.analytics_v2._cache_invalidate_user", new_callable=AsyncMock):
        response = await async_client.put(
            f"/api/v2/posts/{test_post.id}/status",
            json={"status": "pending_review"},
        )
    assert response.status_code == 200
    assert response.json()["status"] == "pending_review"


@pytest.mark.asyncio
async def test_status_invalid_transition(async_client: AsyncClient, test_post: Post):
    """V2-WF-002: invalid transition returns 400."""
    response = await async_client.put(
        f"/api/v2/posts/{test_post.id}/status",
        json={"status": "published"},
    )
    assert response.status_code == 400
    assert "Cannot transition" in response.json()["detail"]


# ─── V2-WF-003: Recycle ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_recycle_published_post(async_client: AsyncClient, published_post: Post):
    """V2-WF-003: Recycling a published post creates a new scheduled post."""
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    with patch("app.tasks.post_tasks.schedule_post") as mock_task:
        mock_task.apply_async.return_value = type("T", (), {"id": "fake-celery-id"})()
        response = await async_client.post(
            f"/api/v2/posts/{published_post.id}/recycle",
            json={"scheduled_at": future},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "scheduled"
    assert data["id"] != str(published_post.id)  # new post created


@pytest.mark.asyncio
async def test_recycle_draft_fails(async_client: AsyncClient, test_post: Post):
    """V2-WF-003: Cannot recycle a draft post."""
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await async_client.post(
        f"/api/v2/posts/{test_post.id}/recycle",
        json={"scheduled_at": future},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_recycle_past_time_fails(async_client: AsyncClient, published_post: Post):
    """V2-WF-003: Recycling with past time returns 400."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    response = await async_client.post(
        f"/api/v2/posts/{published_post.id}/recycle",
        json={"scheduled_at": past},
    )
    assert response.status_code == 400


# ─── V2-WF-004: Bulk upload ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_bulk_upload_too_many_files(async_client: AsyncClient):
    """V2-WF-004: More than 10 files returns 400."""
    import io
    files = [
        ("files", (f"img{i}.jpg", io.BytesIO(b"fake"), "image/jpeg"))
        for i in range(11)
    ]
    response = await async_client.post("/api/v2/upload/bulk", files=files)
    assert response.status_code == 400
    assert "Maximum 10" in response.json()["detail"]


@pytest.mark.asyncio
async def test_bulk_upload_unsupported_type(async_client: AsyncClient):
    """V2-WF-004: Unsupported file type is reported in the error field."""
    import io
    files = [("files", ("doc.pdf", io.BytesIO(b"fake"), "application/pdf"))]
    response = await async_client.post("/api/v2/upload/bulk", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["failed"] == 1
    assert data["uploaded"] == 0
    assert data["items"][0]["error"] is not None


# ─── V2-WF-005: Templates ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_template_crud(async_client: AsyncClient):
    """V2-WF-005: Create, list, get and delete a template."""
    # Create
    create_resp = await async_client.post(
        "/api/v2/templates",
        json={
            "name": "Test Template",
            "caption": "Test caption #testtemplate",
            "hashtags": ["#test", "#template"],
        },
    )
    assert create_resp.status_code == 201
    tmpl = create_resp.json()
    assert tmpl["name"] == "Test Template"
    assert len(tmpl["hashtags"]) == 2

    # List
    list_resp = await async_client.get("/api/v2/templates")
    assert list_resp.status_code == 200
    assert any(t["id"] == tmpl["id"] for t in list_resp.json())

    # Get
    get_resp = await async_client.get(f"/api/v2/templates/{tmpl['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == tmpl["id"]

    # Delete
    del_resp = await async_client.delete(f"/api/v2/templates/{tmpl['id']}")
    assert del_resp.status_code == 204

    # Verify deleted
    get_after = await async_client.get(f"/api/v2/templates/{tmpl['id']}")
    assert get_after.status_code == 404


@pytest.mark.asyncio
async def test_template_name_required(async_client: AsyncClient):
    """V2-WF-005: Template creation without name returns 422."""
    response = await async_client.post(
        "/api/v2/templates",
        json={"caption": "No name template"},
    )
    assert response.status_code == 422


# ─── V2-ACC-003: Migration status ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_migration_status(async_client: AsyncClient, test_account: Account):
    """V2-ACC-003: /accounts/migration-status returns account migration state."""
    response = await async_client.get("/api/v2/accounts/migration-status")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "migrated" in data
    assert "needs_reconnect" in data
    assert "accounts" in data
    # Telegram account does not need reconnect
    telegram_accounts = [a for a in data["accounts"] if a["platform"] == "telegram"]
    for acc in telegram_accounts:
        assert acc["needs_reconnect"] is False
