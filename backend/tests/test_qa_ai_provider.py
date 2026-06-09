"""QA — AI provider selection priority in ai_service._build_client.

Priority: xAI (Grok) → Anthropic → OpenRouter free model → local Ollama.
"""
from types import SimpleNamespace
from unittest.mock import patch

import app.services.ai_service as ai_service
from app.services.ai_service import _build_client, OLLAMA_DEFAULT


def _settings(**over):
    base = dict(
        xai_api_key="", xai_model="grok-3-mini",
        anthropic_api_key="",
        openrouter_api_key="", openrouter_model="openai/gpt-oss-120b:free",
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_openrouter_selected_when_only_openrouter_key():
    with patch.object(ai_service, "_get_settings", return_value=_settings(openrouter_api_key="sk-or-x")):
        _client, primary, secondary = _build_client()
    assert primary == "openai/gpt-oss-120b:free"
    assert secondary == "openai/gpt-oss-120b:free"


def test_xai_takes_priority_over_openrouter():
    s = _settings(xai_api_key="xai-key", openrouter_api_key="sk-or-x")
    with patch.object(ai_service, "_get_settings", return_value=s):
        _client, primary, _ = _build_client()
    assert primary == "grok-3-mini"


def test_falls_back_to_local_ollama_when_no_keys():
    with patch.object(ai_service, "_get_settings", return_value=_settings()):
        _client, primary, _ = _build_client()
    assert primary == OLLAMA_DEFAULT


def test_openrouter_model_contains_slash_so_it_routes_remote():
    """The OpenRouter model must contain '/', which makes call_ollama_chat skip
    local Ollama and go straight to OpenRouter."""
    with patch.object(ai_service, "_get_settings", return_value=_settings(openrouter_api_key="k")):
        _client, primary, _ = _build_client()
    assert "/" in primary
