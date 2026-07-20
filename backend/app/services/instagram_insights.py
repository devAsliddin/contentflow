"""V5 — Instagram Graph API insights fetcher.

Fetches media list, per-post insights, and account-level insights.

Error policy:
  401  → raises TokenExpiredError (caller should flag account for reconnect)
  403  → returns None / graceful degradation
  429  → exponential backoff (2, 4, 8 s)
  5xx / network → 3 retries then re-raise
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class TokenExpiredError(Exception):
    """Raised when Instagram returns 401 (token invalid/expired)."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_BACKOFF = [2, 4, 8]


def _graph_base() -> str:
    return f"https://graph.instagram.com/{settings.instagram_graph_version}"


async def _get(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    *,
    allow_403: bool = False,
) -> dict | None:
    """GET with retry logic. Returns None on 403 if allow_403=True."""
    for attempt in range(4):
        try:
            resp = await client.get(url, params=params)
        except httpx.RequestError as exc:
            if attempt >= 3:
                raise
            logger.warning("ig_insights: network error attempt=%d url=%s err=%s", attempt, url, exc)
            await asyncio.sleep(_BACKOFF[min(attempt, len(_BACKOFF) - 1)])
            continue

        if resp.status_code == 401:
            raise TokenExpiredError(f"Instagram token expired: {resp.text}")

        if resp.status_code == 403:
            if allow_403:
                logger.info("ig_insights: 403 on %s — graceful degradation, returning None", url)
                return None
            raise PermissionError(f"Instagram 403: {resp.text}")

        if resp.status_code == 429:
            sleep_s = float(resp.headers.get("Retry-After", _BACKOFF[min(attempt, len(_BACKOFF) - 1)]))
            logger.warning("ig_insights: 429 rate limit, sleeping %ss", sleep_s)
            await asyncio.sleep(sleep_s)
            continue

        if resp.status_code >= 500:
            if attempt >= 3:
                resp.raise_for_status()
            logger.warning("ig_insights: %d server error attempt=%d", resp.status_code, attempt)
            await asyncio.sleep(_BACKOFF[min(attempt, len(_BACKOFF) - 1)])
            continue

        resp.raise_for_status()
        return resp.json()

    return None  # exhausted retries on 429


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

async def fetch_media_list(token: str, limit: int | None = None) -> list[dict]:
    """Fetch up to `limit` most-recent media items via pagination.

    Fields include like_count and comments_count (public fallback when
    insights scope is not available).
    """
    max_items = limit or settings.analysis_media_limit
    page_size = min(25, max_items)

    items: list[dict] = []
    url = f"{_graph_base()}/me/media"
    params: dict[str, Any] = {
        "fields": (
            "id,caption,media_type,media_product_type,"
            "permalink,timestamp,like_count,comments_count"
        ),
        "limit": page_size,
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            data = await _get(client, url, params)
            if not data:
                break

            batch: list[dict] = data.get("data", [])
            items.extend(batch)

            if len(items) >= max_items:
                items = items[:max_items]
                break

            next_url = data.get("paging", {}).get("next")
            if not next_url:
                break

            # The "next" URL already includes all params
            url = next_url
            params = {}

    logger.info("ig_insights: fetched %d media items", len(items))
    return items


async def fetch_media_insights(
    token: str,
    media_id: str,
    media_type: str,
) -> dict | None:
    """Fetch engagement insights for a single media item.

    Returns None if 403 (scope not granted — use public like/comment counts instead).
    REELS additionally fetch plays and avg_watch_time.
    """
    base_metrics = "reach,impressions,likes,comments,saved,shares"

    # REELS support extra metrics
    is_reel = media_type in ("REELS", "VIDEO")
    metrics = f"{base_metrics},plays,ig_reels_avg_watch_time" if is_reel else base_metrics

    url = f"{_graph_base()}/{media_id}/insights"
    params = {
        "metric": metrics,
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        data = await _get(client, url, params, allow_403=True)

    if data is None:
        return None

    # Flatten the list of {name, values} into a flat dict
    result: dict[str, Any] = {}
    for item in data.get("data", []):
        name = item.get("name")
        values = item.get("values", [])
        if values:
            result[name] = values[0].get("value")
        else:
            # Some metrics use `value` directly (not time-series)
            result[name] = item.get("value")

    return result


async def fetch_account_insights(
    token: str,
    ig_user_id: str,
) -> dict | None:
    """Fetch account-level metrics (reach, impressions, profile_views, demographics).

    Returns None if 403 (insights scope not available).
    """
    url = f"{_graph_base()}/{ig_user_id}/insights"
    params = {
        "metric": "reach,impressions,profile_views",
        "period": "days_28",
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        insights_data = await _get(client, url, params, allow_403=True)

    result: dict[str, Any] = {}

    if insights_data is not None:
        for item in insights_data.get("data", []):
            name = item.get("name")
            values = item.get("values", [])
            if values:
                # Sum all values in the period
                result[name] = sum(v.get("value", 0) for v in values)

    # Fetch follower demographics (best effort)
    demo_url = f"{_graph_base()}/{ig_user_id}/insights"
    demo_params = {
        "metric": "follower_demographics",
        "period": "lifetime",
        "metric_type": "total_value",
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        demo_data = await _get(client, demo_url, demo_params, allow_403=True)

    if demo_data is not None:
        result["demographics"] = demo_data.get("data", [])

    # Fetch basic account info (followers, following, media_count)
    me_url = f"{_graph_base()}/me"
    me_params = {
        "fields": "followers_count,follows_count,media_count,biography,name",
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        me_data = await _get(client, me_url, me_params)

    if me_data:
        result.update(me_data)

    if not result:
        return None

    return result
