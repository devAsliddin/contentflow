"""Groq provider — OpenAI-compatible chat completions.

Free tier: https://console.groq.com
Rate-limited (429) responses honour Retry-After, else exponential backoff.
"""
import asyncio
import logging
import time

import httpx

from app.services.ai.base import AICompletion, AIProvider
from app.config import get_settings

logger = logging.getLogger(__name__)


class _OpenAICompatProvider(AIProvider):
    """Shared implementation for any OpenAI-compatible /chat/completions endpoint."""

    def __init__(
        self,
        *,
        name: str,
        base_url: str,
        api_key: str,
        model: str,
        max_retries: int = 5,
    ) -> None:
        self.name = name
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._max_retries = max_retries

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.3,
    ) -> AICompletion:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        backoff_seconds = [2, 4, 8, 16, 32]
        attempt = 0

        while True:
            t0 = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers=headers,
                        json=body,
                    )
            except httpx.RequestError as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                logger.warning(
                    "ai.request_error provider=%s model=%s attempt=%d latency_ms=%d error=%s",
                    self.name, self._model, attempt, latency_ms, exc,
                )
                if attempt >= self._max_retries - 1:
                    raise
                await asyncio.sleep(backoff_seconds[min(attempt, len(backoff_seconds) - 1)])
                attempt += 1
                continue

            latency_ms = int((time.monotonic() - t0) * 1000)

            if resp.status_code == 429:
                retry_after = _parse_retry_after(resp)
                logger.warning(
                    "ai.rate_limited provider=%s model=%s attempt=%d retry_after_s=%s",
                    self.name, self._model, attempt, retry_after,
                )
                if attempt >= self._max_retries - 1:
                    resp.raise_for_status()
                sleep_s = retry_after if retry_after is not None else backoff_seconds[min(attempt, len(backoff_seconds) - 1)]
                await asyncio.sleep(sleep_s)
                attempt += 1
                continue

            if resp.status_code >= 500:
                logger.warning(
                    "ai.server_error provider=%s model=%s attempt=%d status=%d",
                    self.name, self._model, attempt, resp.status_code,
                )
                if attempt >= self._max_retries - 1:
                    resp.raise_for_status()
                await asyncio.sleep(backoff_seconds[min(attempt, len(backoff_seconds) - 1)])
                attempt += 1
                continue

            resp.raise_for_status()

            data = resp.json()
            choice = data["choices"][0]["message"]["content"]
            usage = data.get("usage") or {}
            input_tokens: int | None = usage.get("prompt_tokens")
            output_tokens: int | None = usage.get("completion_tokens")

            logger.info(
                "ai.complete provider=%s model=%s input_tokens=%s output_tokens=%s latency_ms=%d",
                self.name, self._model, input_tokens, output_tokens, latency_ms,
            )

            return AICompletion(
                text=choice,
                provider=self.name,
                model=self._model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )


def _parse_retry_after(resp: httpx.Response) -> float | None:
    """Return Retry-After seconds or None if header absent/unparseable."""
    header = resp.headers.get("retry-after") or resp.headers.get("Retry-After")
    if not header:
        return None
    try:
        return float(header)
    except (ValueError, TypeError):
        return None


def build_groq_provider() -> _OpenAICompatProvider:
    settings = get_settings()
    return _OpenAICompatProvider(
        name="groq",
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        max_retries=settings.groq_max_retries,
    )
