"""xAI (Grok) client — OpenAI-compatible chat + vision.

Grok exposes an OpenAI-compatible REST API at https://api.x.ai/v1, so both
text chat and image (vision) requests use the same /chat/completions endpoint.
This replaces the local Ollama dependency as the primary AI provider.
"""
import base64
import logging
from pathlib import Path

import httpx
from fastapi import HTTPException

from app.config import get_settings

logger = logging.getLogger(__name__)


def _headers() -> dict:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.xai_api_key}",
        "Content-Type": "application/json",
    }


async def call_xai_chat(
    messages: list[dict],
    model: str | None = None,
    *,
    timeout: int = 120,
) -> str:
    """Send a chat completion request to Grok and return the text reply."""
    settings = get_settings()
    if not settings.xai_api_key:
        raise HTTPException(status_code=503, detail="xAI API key not configured")

    payload = {
        "model": model or settings.xai_model,
        "messages": messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{settings.xai_base_url.rstrip('/')}/chat/completions",
                headers=_headers(),
                json=payload,
            )
    except httpx.HTTPError as exc:
        logger.warning("xAI request error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service request failed") from exc

    if resp.status_code != 200:
        logger.warning("xAI returned %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="AI service request failed")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def call_xai_vision(
    image_path: str,
    prompt: str,
    model: str | None = None,
    *,
    timeout: int = 120,
) -> str:
    """Send an image + prompt to a Grok vision model and return the text reply."""
    settings = get_settings()
    if not settings.xai_api_key:
        raise HTTPException(status_code=503, detail="xAI API key not configured")

    img_bytes = Path(image_path).read_bytes()
    img_b64 = base64.b64encode(img_bytes).decode()
    suffix = Path(image_path).suffix.lower().lstrip(".") or "jpeg"
    mime = "jpeg" if suffix in ("jpg", "jpeg") else suffix

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/{mime};base64,{img_b64}"},
                },
                {"type": "text", "text": prompt},
            ],
        }
    ]

    payload = {
        "model": model or settings.xai_vision_model,
        "messages": messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{settings.xai_base_url.rstrip('/')}/chat/completions",
                headers=_headers(),
                json=payload,
            )
    except httpx.HTTPError as exc:
        logger.warning("xAI vision request error: %s", exc)
        raise HTTPException(status_code=502, detail="AI vision service request failed") from exc

    if resp.status_code != 200:
        logger.warning("xAI vision returned %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="AI vision service request failed")

    data = resp.json()
    return data["choices"][0]["message"]["content"]
