"""Telegram Bot API service."""
import mimetypes
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


def _telegram_error(data: dict) -> str:
    description = data.get("description", "Noma'lum xato")
    if description == "Unauthorized" or data.get("error_code") == 401:
        return (
            "Bot token yaroqsiz yoki BotFather orqali yangilangan. "
            "Accounts sahifasidagi Bot sozlamalari orqali tokenni yangilang."
        )
    if "not enough rights" in description.lower() or "administrator" in description.lower():
        return "Bot kanalga admin qilingan, lekin post yuborish huquqi yo'q."
    if "chat not found" in description.lower():
        return "Kanal topilmadi. @username yoki -100... kanal ID ni tekshiring."
    return description


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
    media_path: str | None = None,
    media_type: str | None = None,
) -> str:
    """Send a post to a Telegram channel. Returns message_id.

    media_path: absolute local filesystem path to the media file.
                If None, sends a text-only message.
    media_type: "image" / "photo" for photos, "video" for videos.
    """
    base_url = f"https://api.telegram.org/bot{bot_token}"

    async with httpx.AsyncClient(timeout=120) as client:
        if media_path and media_type in ("image", "photo"):
            if not Path(media_path).is_file():
                raise FileNotFoundError(f"Media file not found: {media_path}")
            filename = Path(media_path).name
            mime = mimetypes.guess_type(filename)[0] or "image/jpeg"
            with open(media_path, "rb") as f:
                resp = await client.post(
                    f"{base_url}/sendPhoto",
                    data={"chat_id": channel_id, "caption": caption or ""},
                    files={"photo": (filename, f, mime)},
                )

        elif media_path and media_type == "video":
            if not Path(media_path).is_file():
                raise FileNotFoundError(f"Media file not found: {media_path}")
            filename = Path(media_path).name
            mime = mimetypes.guess_type(filename)[0] or "video/mp4"
            with open(media_path, "rb") as f:
                resp = await client.post(
                    f"{base_url}/sendVideo",
                    data={"chat_id": channel_id, "caption": caption or ""},
                    files={"video": (filename, f, mime)},
                )

        else:
            text = caption or ""
            if not text:
                raise ValueError(
                    "Telegram matnli postda caption bo'sh bo'lmasligi kerak"
                )
            resp = await client.post(
                f"{base_url}/sendMessage",
                json={"chat_id": channel_id, "text": text},
            )

    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API xatosi: {_telegram_error(data)}")

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
            raise RuntimeError(f"Kanalga kira olmadi: {_telegram_error(data)}")
        return data["result"]
