"""V6 — Cloudflare Workers AI image generation provider.

Model: @cf/black-forest-labs/flux-1-schnell (configurable via CLOUDFLARE_IMAGE_MODEL).
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
Body: {"prompt": "..."}
Response: binary PNG bytes (Content-Type: image/png) or JSON with base64 image.
"""
from __future__ import annotations

import base64
import logging
import time

import httpx

from app.config import get_settings
from app.services.images.base import ImageProvider, ImageResult

logger = logging.getLogger(__name__)


class CloudflareImageProvider(ImageProvider):
    """Cloudflare Workers AI — flux-1-schnell (or configured model)."""

    @property
    def name(self) -> str:
        return "cloudflare"

    @property
    def model(self) -> str:
        return get_settings().cloudflare_image_model

    def is_available(self) -> bool:
        s = get_settings()
        return bool(s.cloudflare_account_id and s.cloudflare_api_token)

    async def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int | None = None,
    ) -> ImageResult:
        s = get_settings()
        url = (
            f"https://api.cloudflare.com/client/v4/accounts"
            f"/{s.cloudflare_account_id}/ai/run/{s.cloudflare_image_model}"
        )
        body: dict = {"prompt": prompt}
        if seed is not None:
            body["seed"] = seed

        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {s.cloudflare_api_token}"},
            )

        latency_ms = int((time.monotonic() - t0) * 1000)

        if resp.status_code != 200:
            raise httpx.HTTPStatusError(
                f"Cloudflare AI returned {resp.status_code}: {resp.text[:300]}",
                request=resp.request,
                response=resp,
            )

        content_type = resp.headers.get("content-type", "")
        if "image" in content_type:
            image_bytes = resp.content
        else:
            # Cloudflare sometimes returns JSON with base64 image
            try:
                data = resp.json()
                # {"result": {"image": "<base64>"}, "success": true}
                result_obj = data.get("result") or data
                b64 = result_obj.get("image") or result_obj.get("data", "")
                image_bytes = base64.b64decode(b64)
            except Exception as exc:
                raise ValueError(
                    f"Cloudflare: unexpected response format: {resp.text[:300]}"
                ) from exc

        return ImageResult(
            image_bytes=image_bytes,
            provider=self.name,
            model=self.model,
            latency_ms=latency_ms,
        )
