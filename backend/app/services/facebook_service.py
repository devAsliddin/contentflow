"""Facebook Graph API service stub.

Full implementation requires:
- Facebook App Review for pages_manage_posts permission
- Page Access Token (long-lived)
- Graph API v19.0
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class FacebookService:
    def __init__(self, access_token: str, page_id: str):
        self.access_token = access_token
        self.page_id = page_id

    async def publish_post(
        self,
        message: str,
        *,
        media_url: str | None = None,
        scheduled_publish_time: int | None = None,
    ) -> dict[str, Any]:
        """Publish a text or photo post to a Facebook Page.

        Returns the created post id on success.
        Raises RuntimeError on API failure.
        """
        import httpx

        endpoint = (
            f"{GRAPH_BASE}/{self.page_id}/photos"
            if media_url
            else f"{GRAPH_BASE}/{self.page_id}/feed"
        )
        payload: dict[str, Any] = {
            "access_token": self.access_token,
            "message": message,
        }
        if media_url:
            payload["url"] = media_url
        if scheduled_publish_time:
            payload["published"] = False
            payload["scheduled_publish_time"] = scheduled_publish_time

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(endpoint, data=payload)

        if resp.status_code != 200:
            logger.error("Facebook API error %s: %s", resp.status_code, resp.text[:400])
            raise RuntimeError(f"Facebook API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        logger.info("Facebook post published: %s", data)
        return data

    async def get_page_insights(self, metric: str = "page_impressions") -> dict[str, Any]:
        """Fetch basic page-level insights (stub — returns empty dict until permissions granted)."""
        logger.info(
            "FacebookService.get_page_insights called (stub) page=%s metric=%s",
            self.page_id,
            metric,
        )
        return {"metric": metric, "values": []}

    @staticmethod
    def refresh_token_if_needed(credentials: dict[str, Any]) -> dict[str, Any]:
        """Placeholder — Facebook long-lived tokens last ~60 days; implement re-exchange as needed."""
        return credentials
