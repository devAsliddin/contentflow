"""Instagram Graph API service."""
import httpx
import logging

logger = logging.getLogger(__name__)

GRAPH_API = "https://graph.instagram.com/v19.0"


async def verify_instagram_token(access_token: str) -> bool:
    """Verify Instagram access token."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GRAPH_API}/me",
                params={"fields": "id,username", "access_token": access_token},
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Instagram verify failed: {e}")
        return False


async def post_to_instagram(
    access_token: str,
    account_id: str,
    caption: str | None,
    media_url: str | None,
    media_type: str | None,
) -> str:
    """Post photo or reel to Instagram. Returns creation_id."""
    if not media_url:
        raise ValueError("Instagram requires a media URL")

    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: Create media container
        if media_type == "video":
            container_data = {
                "media_type": "REELS",
                "video_url": media_url,
                "caption": caption or "",
                "access_token": access_token,
            }
        else:
            container_data = {
                "image_url": media_url,
                "caption": caption or "",
                "access_token": access_token,
            }

        container_resp = await client.post(
            f"{GRAPH_API}/{account_id}/media",
            data=container_data,
        )
        container_resp.raise_for_status()
        creation_id = container_resp.json()["id"]

        # Step 2: Publish the container
        publish_resp = await client.post(
            f"{GRAPH_API}/{account_id}/media_publish",
            data={"creation_id": creation_id, "access_token": access_token},
        )
        publish_resp.raise_for_status()
        return publish_resp.json()["id"]


async def get_account_info(access_token: str, account_id: str) -> dict:
    """Get Instagram account info."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{GRAPH_API}/{account_id}",
            params={
                "fields": "id,username,followers_count,media_count,profile_picture_url",
                "access_token": access_token,
            },
        )
        resp.raise_for_status()
        return resp.json()
