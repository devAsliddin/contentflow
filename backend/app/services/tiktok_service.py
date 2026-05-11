"""TikTok Content Posting API service."""
import httpx
import logging

logger = logging.getLogger(__name__)

TIKTOK_API = "https://open.tiktokapis.com/v2"


async def verify_tiktok_token(access_token: str, open_id: str) -> bool:
    """Verify TikTok access token."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{TIKTOK_API}/user/info/",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "open_id,display_name"},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"TikTok verify failed: {e}")
        return False


async def post_to_tiktok(
    access_token: str,
    open_id: str,
    caption: str | None,
    media_url: str | None,
) -> str:
    """Post video to TikTok. Returns publish_id."""
    if not media_url:
        raise ValueError("TikTok requires a video URL")

    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: Initialize upload
        init_resp = await client.post(
            f"{TIKTOK_API}/post/publish/video/init/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={
                "post_info": {
                    "title": caption or "",
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "video_url": media_url,
                },
            },
        )
        init_resp.raise_for_status()
        data = init_resp.json()["data"]
        return data.get("publish_id", "unknown")


async def get_user_info(access_token: str) -> dict:
    """Get TikTok user info."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{TIKTOK_API}/user/info/",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"fields": "open_id,display_name,avatar_url,follower_count"},
        )
        resp.raise_for_status()
        return resp.json().get("data", {}).get("user", {})
