"""V6 — ImageProvider router: fallback chain with retry logic.

`generate_image(prompt, width, height, seed)` tries each provider in
IMAGE_FALLBACK_CHAIN order:
  - Providers with no credentials (is_available() == False) are silently skipped.
  - On 429 or 5xx: exponential backoff, max 3 attempts per provider.
  - On success: returns ImageResult (provider name NOT exposed to callers).
  - If all providers fail: raises the last exception.
"""
from __future__ import annotations

import asyncio
import logging
import random

import httpx

from app.config import get_settings
from app.services.images.base import ImageProvider, ImageResult

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3
_INITIAL_BACKOFF = 1.0  # seconds
_BACKOFF_FACTOR = 2.0


def _build_providers() -> list[ImageProvider]:
    """Instantiate providers in IMAGE_FALLBACK_CHAIN order, skipping unavailable."""
    settings = get_settings()
    chain_names = [n.strip().lower() for n in settings.image_fallback_chain.split(",") if n.strip()]

    providers: list[ImageProvider] = []
    seen: set[str] = set()

    for name in chain_names:
        if name in seen:
            continue
        seen.add(name)
        provider = _make_provider(name)
        if provider is None:
            continue
        if not provider.is_available():
            logger.debug("image.router: skipping provider %r (not available)", name)
            continue
        providers.append(provider)

    return providers


def _make_provider(name: str) -> ImageProvider | None:
    if name == "replicate":
        from app.services.images.replicate_provider import ReplicateImageProvider
        return ReplicateImageProvider()
    if name == "cloudflare":
        from app.services.images.cloudflare_provider import CloudflareImageProvider
        return CloudflareImageProvider()
    if name == "pollinations":
        from app.services.images.pollinations_provider import PollinationsImageProvider
        return PollinationsImageProvider()
    logger.warning("image.router: unknown provider name %r — skipping", name)
    return None


def _is_retryable(exc: Exception) -> bool:
    """Return True for transient errors (429, 5xx, network)."""
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (429, 500, 502, 503, 504)
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError)):
        return True
    return False


async def _try_provider(
    provider: ImageProvider,
    prompt: str,
    width: int,
    height: int,
    seed: int | None,
) -> ImageResult:
    """Attempt one provider with up to _MAX_ATTEMPTS retries on transient errors."""
    last_exc: Exception = RuntimeError("No attempts made")
    backoff = _INITIAL_BACKOFF

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            result = await provider.generate(prompt=prompt, width=width, height=height, seed=seed)
            return result
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if _is_retryable(exc) and attempt < _MAX_ATTEMPTS:
                jitter = random.uniform(0, backoff * 0.3)
                sleep_for = backoff + jitter
                logger.warning(
                    "image.router: provider=%s attempt=%d/%d retryable error=%s; retry in %.1fs",
                    provider.name, attempt, _MAX_ATTEMPTS, exc, sleep_for,
                )
                await asyncio.sleep(sleep_for)
                backoff *= _BACKOFF_FACTOR
            else:
                logger.warning(
                    "image.router: provider=%s attempt=%d/%d final error=%s",
                    provider.name, attempt, _MAX_ATTEMPTS, exc,
                )
                break

    raise last_exc


async def generate_image(
    prompt: str,
    width: int,
    height: int,
    seed: int | None = None,
) -> ImageResult:
    """Generate an image using the configured fallback chain.

    Raises the last exception if all providers fail.
    Provider identity is internal — callers should NOT expose provider name to users.
    """
    providers = _build_providers()

    if not providers:
        raise RuntimeError(
            "No image provider available. "
            "Configure CLOUDFLARE_ACCOUNT_ID+CLOUDFLARE_API_TOKEN or check IMAGE_FALLBACK_CHAIN."
        )

    last_exc: Exception = RuntimeError("No providers tried")

    for i, provider in enumerate(providers):
        try:
            result = await _try_provider(provider, prompt, width, height, seed)
            logger.info(
                "image.router: success provider=%s latency_ms=%d",
                provider.name, result.latency_ms,
            )
            return result
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if i < len(providers) - 1:
                logger.warning(
                    "image.router: provider=%s exhausted, trying next. error=%s",
                    provider.name, exc,
                )
            else:
                logger.error(
                    "image.router: all providers exhausted. last_provider=%s error=%s",
                    provider.name, exc,
                )

    raise last_exc
