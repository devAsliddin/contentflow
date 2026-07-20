"""V6 — Replicate image generation provider (primary).

Uses the synchronous "models" prediction endpoint:
    POST https://api.replicate.com/v1/models/{model}/predictions
    Headers: Authorization: Bearer {token}, Prefer: wait
    Body:    {"input": {"prompt": ..., "aspect_ratio": ..., "output_format": "png"}}

The `Prefer: wait` header makes Replicate block until the prediction finishes
(up to ~60s). The prediction `output` is one or more image URLs; we download the
first one and return its bytes. If the prediction is still processing when the
request returns, we poll `urls.get` until it succeeds.

Default model: black-forest-labs/flux-schnell (fast, cheap text-to-image).
flux models take an `aspect_ratio` preset rather than width/height, so we map the
requested width/height to the nearest preset.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx

from app.config import get_settings
from app.services.images.base import ImageProvider, ImageResult

logger = logging.getLogger(__name__)

_API_BASE = "https://api.replicate.com/v1"
_MAX_POLLS = 60          # poll up to ~60 times
_POLL_INTERVAL = 1.5     # seconds between polls


def _aspect_ratio(width: int, height: int) -> str:
    """Map width/height to the nearest flux aspect_ratio preset."""
    if height > width:
        return "9:16"
    if width > height:
        return "16:9"
    return "1:1"


class ReplicateImageProvider(ImageProvider):
    """Replicate — text-to-image via the synchronous predictions endpoint."""

    @property
    def name(self) -> str:
        return "replicate"

    @property
    def model(self) -> str:
        return get_settings().replicate_image_model

    def is_available(self) -> bool:
        return bool((get_settings().replicate_api_token or "").strip())

    async def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int | None = None,
    ) -> ImageResult:
        s = get_settings()
        token = s.replicate_api_token.strip()
        model = s.replicate_image_model
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "wait",
        }
        image_input: dict = {
            "prompt": prompt,
            "aspect_ratio": _aspect_ratio(width, height),
            "output_format": "png",
        }
        if seed is not None:
            image_input["seed"] = seed

        url = f"{_API_BASE}/models/{model}/predictions"

        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            resp = await client.post(url, json={"input": image_input}, headers=headers)
            if resp.status_code not in (200, 201):
                raise httpx.HTTPStatusError(
                    f"Replicate returned {resp.status_code}: {resp.text[:300]}",
                    request=resp.request,
                    response=resp,
                )

            prediction = resp.json()
            output_url = await self._resolve_output(client, prediction, headers)

            img_resp = await client.get(output_url)
            if img_resp.status_code != 200:
                raise httpx.HTTPStatusError(
                    f"Replicate output download failed {img_resp.status_code}",
                    request=img_resp.request,
                    response=img_resp,
                )
            image_bytes = img_resp.content

        latency_ms = int((time.monotonic() - t0) * 1000)
        return ImageResult(
            image_bytes=image_bytes,
            provider=self.name,
            model=self.model,
            latency_ms=latency_ms,
        )

    async def _resolve_output(
        self,
        client: httpx.AsyncClient,
        prediction: dict,
        headers: dict,
    ) -> str:
        """Return the first image URL, polling the prediction if not finished yet."""
        get_url = (prediction.get("urls") or {}).get("get")

        for _ in range(_MAX_POLLS):
            status = prediction.get("status")
            if status == "succeeded":
                return self._first_output_url(prediction.get("output"))
            if status in ("failed", "canceled"):
                err = prediction.get("error") or status
                raise ValueError(f"Replicate prediction {status}: {err}")
            # Still starting/processing — poll.
            if not get_url:
                raise ValueError("Replicate: no polling URL and prediction not finished")
            await asyncio.sleep(_POLL_INTERVAL)
            poll = await client.get(get_url, headers=headers)
            poll.raise_for_status()
            prediction = poll.json()

        raise TimeoutError("Replicate prediction timed out")

    @staticmethod
    def _first_output_url(output) -> str:
        if isinstance(output, str):
            return output
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, str):
                return first
        raise ValueError(f"Replicate: unexpected output format: {output!r}")
