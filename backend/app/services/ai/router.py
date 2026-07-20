"""AI router — maps task_type → provider, handles fallback chain.

task_type   primary provider (from config)
─────────   ──────────────────────────────
analysis    AI_ANALYSIS_PROVIDER
classification  AI_CLASSIFICATION_PROVIDER
content     AI_CONTENT_PROVIDER

Fallback: if the primary provider fails after its own retries, walk
AI_FALLBACK_CHAIN in order, skipping providers that have no API key
configured or that are the same as the one that already failed.
Each fallback emits a WARNING log.
"""
from __future__ import annotations

import logging
from typing import Literal

from app.services.ai.base import AICompletion, AIProvider
from app.config import get_settings

logger = logging.getLogger(__name__)

TaskType = Literal["analysis", "classification", "content"]


def _build_provider(name: str) -> AIProvider | None:
    """Instantiate a provider by its short name. Returns None if no key."""
    settings = get_settings()
    name = name.strip().lower()

    if name == "groq":
        if not settings.groq_api_key:
            return None
        from app.services.ai.groq_provider import build_groq_provider
        return build_groq_provider()

    if name == "openrouter":
        if not settings.openrouter_api_key:
            return None
        from app.services.ai.openrouter_provider import build_openrouter_provider
        return build_openrouter_provider()

    if name == "vllm":
        # vLLM has no API key — check only that base URL is set
        if not settings.vllm_base_url:
            return None
        from app.services.ai.vllm_provider import build_vllm_provider
        return build_vllm_provider()

    if name == "ollama":
        # Local Ollama — no API key; check only that the URL is set
        if not settings.ollama_url:
            return None
        from app.services.ai.ollama_provider import build_ollama_provider
        return build_ollama_provider()

    if name == "anthropic":
        if not settings.anthropic_api_key:
            return None
        from app.services.ai.anthropic_provider import AnthropicProvider
        return AnthropicProvider()

    logger.warning("ai.router: unknown provider name %r — skipping", name)
    return None


def _get_primary_name(task_type: TaskType) -> str:
    settings = get_settings()
    if task_type == "analysis":
        return settings.ai_analysis_provider
    if task_type == "classification":
        return settings.ai_classification_provider
    if task_type == "content":
        return settings.ai_content_provider
    return "groq"


def _build_chain(task_type: TaskType) -> list[AIProvider]:
    """Return ordered list of available providers for this task type.

    The primary provider goes first; remaining slots filled from
    AI_FALLBACK_CHAIN (skipping the primary to avoid duplication and
    skipping providers without credentials).
    """
    settings = get_settings()
    primary_name = _get_primary_name(task_type)
    fallback_names = [n.strip().lower() for n in settings.ai_fallback_chain.split(",") if n.strip()]

    chain: list[AIProvider] = []
    seen: set[str] = set()

    for name in [primary_name] + fallback_names:
        if name in seen:
            continue
        seen.add(name)
        provider = _build_provider(name)
        if provider is not None:
            chain.append(provider)
        else:
            logger.debug("ai.router: skipping provider %r (no credentials)", name)

    return chain


async def complete_for_task(
    task_type: TaskType,
    *,
    system: str,
    prompt: str,
    max_tokens: int = 2000,
    temperature: float = 0.3,
) -> AICompletion:
    """Complete a prompt for the given task type, with fallback chain.

    Raises the last exception if all providers in the chain fail.
    """
    chain = _build_chain(task_type)

    if not chain:
        raise RuntimeError(
            f"No AI provider available for task_type={task_type!r}. "
            "Check AI_* env vars and API keys."
        )

    last_exc: Exception = RuntimeError("No providers tried")

    for i, provider in enumerate(chain):
        try:
            return await provider.complete(
                system=system,
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if i < len(chain) - 1:
                next_provider = chain[i + 1]
                logger.warning(
                    "ai.fallback task_type=%s failed_provider=%s next_provider=%s error=%s",
                    task_type, provider.name, next_provider.name, exc,
                )
            else:
                logger.error(
                    "ai.chain_exhausted task_type=%s last_provider=%s error=%s",
                    task_type, provider.name, exc,
                )

    raise last_exc
