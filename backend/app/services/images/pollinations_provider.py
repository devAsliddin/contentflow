"""V6 — Pollinations.ai image generation provider.

GET {POLLINATIONS_BASE_URL}/prompt/{url_encoded_prompt}?width=&height=&nologo=true&seed=
Response: binary PNG/JPEG bytes.

Note: Pollinations closed its anonymous free tier (now returns 402). A free
account token (register at https://enter.pollinations.ai) restores free access —
set POLLINATIONS_API_TOKEN and it is sent as a Bearer header.
"""
from __future__ import annotations

import logging
import time
from urllib.parse import quote

import httpx

from app.config import get_settings
from app.services.images.base import ImageProvider, ImageResult

logger = logging.getLogger(__name__)

_MODEL = "pollinations-default"


class PollinationsImageProvider(ImageProvider):
    """Pollinations.ai — free image generation via HTTP GET."""

    @property
    def name(self) -> str:
        return "pollinations"

    @property
    def model(self) -> str:
        return _MODEL

    def is_available(self) -> bool:
        # No API key required — only need the base URL configured (has a default)
        return bool(get_settings().pollinations_base_url)

    async def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int | None = None,
    ) -> ImageResult:
        s = get_settings()
        base = s.pollinations_base_url.rstrip("/")
        encoded_prompt = quote(prompt, safe="")
        url = f"{base}/prompt/{encoded_prompt}"
        params: dict = {
            "width": width,
            "height": height,
            "nologo": "true",
        }
        if seed is not None:
            params["seed"] = seed

        headers: dict = {}
        token = (s.pollinations_api_token or "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        t0 = time.monotonic()
        async with httpx.AsyncClient(
            timeout=120,
            follow_redirects=True,
        ) as client:
            resp = await client.get(url, params=params, headers=headers)

        latency_ms = int((time.monotonic() - t0) * 1000)

        if resp.status_code != 200:
            raise httpx.HTTPStatusError(
                f"Pollinations returned {resp.status_code}: {resp.text[:300]}",
                request=resp.request,
                response=resp,
            )

        image_bytes = resp.content
        return ImageResult(
            image_bytes=image_bytes,
            provider=self.name,
            model=self.model,
            latency_ms=latency_ms,
        )
