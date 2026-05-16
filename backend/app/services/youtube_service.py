"""YouTube Data API v3 service stub.

Full implementation requires:
- Google Cloud project with YouTube Data API v3 enabled
- OAuth 2.0 credentials (client_id, client_secret)
- Scopes: https://www.googleapis.com/auth/youtube.upload
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

API_BASE = "https://www.googleapis.com/youtube/v3"
UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"


class YouTubeService:
    def __init__(self, access_token: str, refresh_token: str | None = None):
        self.access_token = access_token
        self.refresh_token = refresh_token

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def upload_video(
        self,
        *,
        video_path: str,
        title: str,
        description: str = "",
        tags: list[str] | None = None,
        privacy_status: str = "public",
    ) -> dict[str, Any]:
        """Upload a video to YouTube using the resumable upload API.

        This is a stub — full implementation requires streaming the video bytes.
        Raises NotImplementedError until video upload is fully implemented.
        """
        logger.info(
            "YouTubeService.upload_video called (stub) title=%s privacy=%s",
            title,
            privacy_status,
        )
        raise NotImplementedError(
            "YouTube video upload requires streaming implementation. "
            "Use google-auth + googleapiclient for production."
        )

    async def create_post(
        self,
        title: str,
        description: str,
        *,
        video_url: str | None = None,
        privacy_status: str = "public",
    ) -> dict[str, Any]:
        """Community post (text + optional image) via YouTube Data API.

        Community posts require channel eligibility (1000+ subscribers).
        This stub returns a placeholder response.
        """
        logger.info(
            "YouTubeService.create_post called (stub) title=%s", title
        )
        return {
            "kind": "youtube#communityPost",
            "stub": True,
            "title": title,
            "description": description,
        }

    async def refresh_access_token(self) -> str:
        """Refresh the access token using the refresh token."""
        if not self.refresh_token:
            raise RuntimeError("No refresh token available")

        from app.config import get_settings
        import httpx

        settings = get_settings()
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.youtube_client_id,
                    "client_secret": settings.youtube_client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                },
            )
        if resp.status_code != 200:
            raise RuntimeError(f"YouTube token refresh failed: {resp.status_code}")
        data = resp.json()
        self.access_token = data["access_token"]
        return self.access_token
