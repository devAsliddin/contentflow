import base64
import logging
from pathlib import Path

import httpx
from fastapi import HTTPException

from app.config import get_settings

logger = logging.getLogger(__name__)


def ollama_url() -> str:
    return get_settings().ollama_url


def _openrouter_model(requested_model: str) -> str:
    settings = get_settings()
    if "/" in requested_model or requested_model.startswith("openrouter/"):
        return requested_model
    return settings.openrouter_model


async def _call_openrouter_chat(
    messages: list[dict],
    model: str,
    *,
    timeout: int,
    include_error_body: bool,
) -> str:
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "ContentFlow",
    }
    payload = {
        "model": _openrouter_model(model),
        "messages": messages,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )

    if resp.status_code != 200:
        detail = f"OpenRouter xatosi: {resp.status_code}"
        if include_error_body:
            detail += f" - {resp.text[:200]}"
        raise HTTPException(status_code=502, detail=detail)

    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _chat_payload(model: str, messages: list[dict], *, cpu_fallback: bool = False) -> dict:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    if cpu_fallback:
        payload["options"] = {
            "num_ctx": 512,
        }
    return payload


async def call_ollama_chat(
    messages: list[dict],
    model: str,
    *,
    timeout: int = 180,
    include_error_body: bool = True,
) -> str:
    settings = get_settings()

    # Try local Ollama first (unless the model name is explicitly an OpenRouter path like "openai/…")
    is_openrouter_model = "/" in model or model.startswith("openrouter/")
    if not is_openrouter_model:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{ollama_url()}/api/chat",
                    json=_chat_payload(model, messages),
                )

                if resp.status_code >= 500:
                    logger.warning(
                        "Ollama returned %s, retrying with reduced context: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    resp = await client.post(
                        f"{ollama_url()}/api/chat",
                        json=_chat_payload(model, messages, cpu_fallback=True),
                    )

                if resp.status_code == 200:
                    return resp.json()["message"]["content"]

                logger.warning("Local Ollama failed (%s), trying OpenRouter", resp.status_code)
        except httpx.ConnectError:
            logger.warning("Local Ollama not reachable, trying OpenRouter")

    # OpenRouter fallback (when local Ollama unavailable or model is explicit OpenRouter path)
    if settings.openrouter_api_key:
        try:
            return await _call_openrouter_chat(
                messages,
                model,
                timeout=timeout,
                include_error_body=include_error_body,
            )
        except HTTPException as exc:
            logger.warning("OpenRouter also failed: %s", exc.detail)

    raise HTTPException(
        status_code=502,
        detail="AI xizmati mavjud emas. Ollama ishlamayapti va OpenRouter ham javob bermadi.",
    )


async def call_ollama_vision(
    image_path: str,
    prompt: str,
    model: str = "gemma3:4b",
    timeout: int = 180,
) -> str:
    """Send an image to a vision-capable Ollama model and return the response."""
    img_bytes = Path(image_path).read_bytes()
    img_b64 = base64.b64encode(img_bytes).decode()

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [img_b64],
            }
        ],
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{ollama_url()}/api/chat", json=payload)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Vision model xatosi: {resp.status_code} - {resp.text[:300]}",
            )
        return resp.json()["message"]["content"]
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama ishlamayapti. Terminalda: ollama serve")
