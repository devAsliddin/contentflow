"""vLLM provider — self-hosted OpenAI-compatible endpoint (no API key needed).

vLLM serves at VLLM_BASE_URL/chat/completions.
"""
from app.services.ai.groq_provider import _OpenAICompatProvider
from app.config import get_settings


def build_vllm_provider() -> _OpenAICompatProvider:
    settings = get_settings()
    return _OpenAICompatProvider(
        name="vllm",
        base_url=settings.vllm_base_url,
        api_key="ignored",   # vLLM typically has no auth
        model=settings.vllm_model,
        max_retries=3,
    )
