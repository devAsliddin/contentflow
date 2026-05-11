"""Telegram Bot API service."""
import httpx
import logging

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}"


async def verify_telegram_bot(bot_token: str) -> bool:
    """Verify bot token is valid."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
            return resp.status_code == 200 and resp.json().get("ok", False)
    except Exception as e:
        logger.error(f"Telegram verify failed: {e}")
        return False


async def send_post_to_telegram(
    bot_token: str,
    channel_id: str,
    caption: str | None,
    media_url: str | None,
    media_type: str | None,
) -> str:
    """Send a post to a Telegram channel. Returns message_id."""
    base_url = f"https://api.telegram.org/bot{bot_token}"

    async with httpx.AsyncClient(timeout=30) as client:
        if media_url and media_type == "photo":
            resp = await client.post(
                f"{base_url}/sendPhoto",
                json={"chat_id": channel_id, "photo": media_url, "caption": caption or ""},
            )
        elif media_url and media_type == "video":
            resp = await client.post(
                f"{base_url}/sendVideo",
                json={"chat_id": channel_id, "video": media_url, "caption": caption or ""},
            )
        else:
            resp = await client.post(
                f"{base_url}/sendMessage",
                json={"chat_id": channel_id, "text": caption or ""},
            )

        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram API error: {data.get('description', 'Unknown error')}")

        return str(data["result"]["message_id"])


async def get_channel_info(bot_token: str, channel_id: str) -> dict:
    """Get channel information."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"https://api.telegram.org/bot{bot_token}/getChat",
            params={"chat_id": channel_id},
        )
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Cannot access channel: {data.get('description', 'Unknown error')}")
        return data["result"]
