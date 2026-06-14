"""Ollama provider — local OpenAI-compatible endpoint (no API key needed).

Ollama serves the OpenAI-compatible API at OLLAMA_URL/v1/chat/completions.
Reuses the existing OLLAMA_URL setting; the model comes from OLLAMA_MODEL.
"""
from app.services.ai.groq_provider import _OpenAICompatProvider
from app.config import get_settings


def build_ollama_provider() -> _OpenAICompatProvider:
    settings = get_settings()
    base_url = settings.ollama_url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = f"{base_url}/v1"
    return _OpenAICompatProvider(
        name="ollama",
        base_url=base_url,
        api_key="ignored",   # Ollama has no auth
        model=settings.ollama_model,
        max_retries=3,
    )
