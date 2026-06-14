"""Anthropic provider stub — full interface, not routed by default.

The router never selects this provider unless AI_ANALYSIS_PROVIDER=anthropic
(or similar) is set. The implementation is complete so that switching to
Claude requires only an .env change.

Uses the Anthropic Messages API directly via httpx (no SDK needed).
"""
import logging
import time

import httpx

from app.services.ai.base import AICompletion, AIProvider
from app.config import get_settings

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class AnthropicProvider(AIProvider):
    name = "anthropic"

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.anthropic_api_key
        self._model = settings.anthropic_analysis_model

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.3,
    ) -> AICompletion:
        if not self._api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")

        headers = {
            "x-api-key": self._api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        body = {
            "model": self._model,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(ANTHROPIC_API_URL, headers=headers, json=body)

        latency_ms = int((time.monotonic() - t0) * 1000)
        resp.raise_for_status()

        data = resp.json()
        text = data["content"][0]["text"]
        usage = data.get("usage") or {}
        input_tokens: int | None = usage.get("input_tokens")
        output_tokens: int | None = usage.get("output_tokens")

        logger.info(
            "ai.complete provider=anthropic model=%s input_tokens=%s output_tokens=%s latency_ms=%d",
            self._model, input_tokens, output_tokens, latency_ms,
        )

        return AICompletion(
            text=text,
            provider=self.name,
            model=self._model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
