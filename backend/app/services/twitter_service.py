"""X (Twitter) API v2 service stub.

Full implementation requires:
- Twitter Developer account with Elevated access
- OAuth 2.0 PKCE or OAuth 1.0a credentials
- tweet.write scope
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

API_BASE = "https://api.twitter.com/2"


class TwitterService:
    def __init__(
        self,
        *,
        bearer_token: str | None = None,
        access_token: str | None = None,
        access_token_secret: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
    ):
        self.bearer_token = bearer_token
        self.access_token = access_token
        self.access_token_secret = access_token_secret
        self.api_key = api_key
        self.api_secret = api_secret

    def _bearer_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.bearer_token}"}

    def _oauth1_headers(self, method: str, url: str, params: dict | None = None) -> dict[str, str]:
        """Generate OAuth 1.0a Authorization header using requests-oauthlib."""
        try:
            from requests_oauthlib import OAuth1  # type: ignore
            import requests

            auth = OAuth1(
                self.api_key,
                self.api_secret,
                self.access_token,
                self.access_token_secret,
            )
            # Build the header string manually via a prepared request
            prepared = requests.Request(method, url, params=params, auth=auth).prepare()
            return dict(prepared.headers)
        except ImportError:
            logger.warning("requests-oauthlib not installed; OAuth 1.0a signing unavailable")
            return {}

    async def create_tweet(
        self,
        text: str,
        *,
        media_ids: list[str] | None = None,
        reply_to_tweet_id: str | None = None,
    ) -> dict[str, Any]:
        """Post a tweet using OAuth 2.0 user context.

        Requires tweet.write scope and OAuth 2.0 access token.
        Falls back to a stub response if credentials are incomplete.
        """
        import httpx

        if not self.access_token:
            logger.warning("TwitterService.create_tweet: no access_token — returning stub")
            return {"data": {"id": "stub", "text": text}}

        payload: dict[str, Any] = {"text": text}
        if media_ids:
            payload["media"] = {"media_ids": media_ids}
        if reply_to_tweet_id:
            payload["reply"] = {"in_reply_to_tweet_id": reply_to_tweet_id}

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{API_BASE}/tweets",
                headers=headers,
                json=payload,
            )

        if resp.status_code not in (200, 201):
            logger.error("Twitter API error %s: %s", resp.status_code, resp.text[:400])
            raise RuntimeError(f"Twitter API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        logger.info("Tweet posted: %s", data.get("data", {}).get("id"))
        return data

    async def get_me(self) -> dict[str, Any]:
        """Get authenticated user info."""
        import httpx

        if not self.access_token:
            return {"data": {"id": "stub", "username": "unknown"}}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{API_BASE}/users/me",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Twitter /me failed: {resp.status_code}")
        return resp.json()

    @staticmethod
    def refresh_token_if_needed(credentials: dict[str, Any]) -> dict[str, Any]:
        """OAuth 2.0 tokens can be refreshed; implement as needed."""
        return credentials
