"""OpenRouter provider — OpenAI-compatible free-model fallback.

Docs: https://openrouter.ai/docs
"""
from app.services.ai.groq_provider import _OpenAICompatProvider
from app.config import get_settings


def build_openrouter_provider() -> _OpenAICompatProvider:
    settings = get_settings()
    return _OpenAICompatProvider(
        name="openrouter",
        base_url=settings.openrouter_base_url,
        api_key=settings.openrouter_api_key,
        model=settings.openrouter_model,
        max_retries=3,
    )
