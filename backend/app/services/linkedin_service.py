"""LinkedIn API v2 service stub.

Full implementation requires:
- LinkedIn app with r_liteprofile, w_member_social permissions
- OAuth 2.0 3-legged flow
- UGC Posts API for publishing
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

API_BASE = "https://api.linkedin.com/v2"


class LinkedInService:
    def __init__(self, access_token: str, person_urn: str):
        self.access_token = access_token
        # e.g. "urn:li:person:XXXXXXXX"
        self.person_urn = person_urn

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

    async def publish_post(
        self,
        text: str,
        *,
        media_url: str | None = None,
    ) -> dict[str, Any]:
        """Publish a UGC post to LinkedIn.

        Returns the created post URN on success.
        Raises RuntimeError on API failure.
        """
        import httpx

        payload: dict[str, Any] = {
            "author": self.person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }

        if media_url:
            payload["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
            payload["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                {
                    "status": "READY",
                    "originalUrl": media_url,
                }
            ]

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{API_BASE}/ugcPosts",
                headers=self._headers(),
                json=payload,
            )

        if resp.status_code not in (200, 201):
            logger.error("LinkedIn API error %s: %s", resp.status_code, resp.text[:400])
            raise RuntimeError(f"LinkedIn API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        logger.info("LinkedIn post published: %s", data.get("id"))
        return data

    async def get_profile(self) -> dict[str, Any]:
        """Fetch basic profile info."""
        import httpx

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{API_BASE}/me",
                headers=self._headers(),
                params={"projection": "(id,localizedFirstName,localizedLastName)"},
            )
        if resp.status_code != 200:
            raise RuntimeError(f"LinkedIn profile fetch failed: {resp.status_code}")
        return resp.json()

    @staticmethod
    def refresh_token_if_needed(credentials: dict[str, Any]) -> dict[str, Any]:
        """LinkedIn access tokens expire after 60 days; implement re-exchange as needed."""
        return credentials
