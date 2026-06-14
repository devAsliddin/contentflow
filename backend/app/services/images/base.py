"""V6 — ImageProvider ABC and ImageResult dataclass."""
from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass
class ImageResult:
    """Result of a successful image generation."""
    image_bytes: bytes
    provider: str   # internal name — NEVER exposed to the user
    model: str
    latency_ms: int


class ImageProvider(abc.ABC):
    """Abstract base for all image generation backends."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Short internal identifier (e.g. 'cloudflare', 'pollinations')."""
        ...

    @property
    @abc.abstractmethod
    def model(self) -> str:
        """Model/endpoint identifier used by this provider."""
        ...

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Return True if the required credentials / config are present.

        Returning False causes the router to skip this provider silently.
        """
        ...

    @abc.abstractmethod
    async def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int | None = None,
    ) -> ImageResult:
        """Generate an image.

        Raises:
            httpx.HTTPStatusError / Exception on 4xx/5xx.
        """
        ...
