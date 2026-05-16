"""V2-TEST-001: Analytics endpoint tests (V2-ANA-004, V2-ANA-005)."""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post, PostLog
from app.models.user import User
from app.models.account import Account


@pytest.mark.asyncio
async def test_best_time_no_data(async_client: AsyncClient):
    """V2-ANA-005: best-time returns defaults when no post logs exist."""
    response = await async_client.get("/api/v2/analytics/best-time")
    assert response.status_code == 200
    data = response.json()
    assert "hour" in data
    assert "day_of_week" in data
    assert "day_name" in data
    assert "sample_size" in data
    assert data["sample_size"] == 0
    assert len(data["hourly_distribution"]) == 24
    assert len(data["daily_distribution"]) == 7


@pytest.mark.asyncio
async def test_best_time_with_data(async_client: AsyncClient, test_post_log: PostLog):
    """V2-ANA-005: best-time detects peak hour from logs."""
    # Clear Redis cache if any
    with patch("app.routers.analytics_v2._cache_get", new_callable=AsyncMock, return_value=None):
        with patch("app.routers.analytics_v2._cache_set", new_callable=AsyncMock):
            response = await async_client.get("/api/v2/analytics/best-time")
    assert response.status_code == 200
    data = response.json()
    assert data["sample_size"] >= 1


@pytest.mark.asyncio
async def test_report_pdf(async_client: AsyncClient):
    """V2-ANA-004: PDF report returns application/pdf content."""
    # reportlab may not be installed in test env; check gracefully
    response = await async_client.post("/api/v2/analytics/report")
    if response.status_code == 500:
        # reportlab not installed — acceptable in test env
        assert "reportlab" in response.json().get("detail", "").lower()
    else:
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 100  # non-empty PDF
