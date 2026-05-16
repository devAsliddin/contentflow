"""AI chat — Anthropic Claude primary, Ollama local fallback."""
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Literal

from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.middleware.auth_middleware import get_current_user
from app.config import get_settings
from app.services.ollama_client import call_ollama_chat, ollama_url

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_OLLAMA_MODEL = "llama3.2"
DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# ── System prompts ────────────────────────────────────────────────────────────

BASE_SYSTEM = """You are ContentFlow AI — a professional social media management assistant.
You help users with:
- Content strategy and scheduling (weekly, monthly, quarterly plans)
- Writing posts for Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube, and X/Twitter
- Hashtag suggestions
- Target audience analysis
- Optimal posting times
- Channel growth strategy

Rules:
- Reply in the same language the user writes in (English, Russian, Uzbek, etc.)
- Give concrete, actionable advice
- Be concise and direct"""


def build_system_with_accounts(accounts: list[dict]) -> str:
    if not accounts:
        return BASE_SYSTEM + "\n\nThe user has no connected platforms yet."

    platform_lines = [
        f"  - {acc['platform'].capitalize()}: @{acc['account_name']}"
        for acc in accounts
    ]
    accounts_block = "User's connected platforms:\n" + "\n".join(platform_lines)
    return f"{BASE_SYSTEM}\n\n{accounts_block}"


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str = Field(default=DEFAULT_OLLAMA_MODEL, max_length=100)


class PlanChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str = Field(default=DEFAULT_OLLAMA_MODEL, max_length=100)


class ChatResponse(BaseModel):
    message: ChatMessage
    model: str


# ── AI call helpers ───────────────────────────────────────────────────────────

async def _call_anthropic(messages: list[dict], system: str | None = None) -> str:
    """Call Anthropic Claude API directly."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("No Anthropic API key configured")
    try:
        import anthropic  # type: ignore
    except ImportError:
        raise RuntimeError("anthropic package not installed")

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    # Filter out system messages from list — Anthropic takes system separately
    user_messages = [m for m in messages if m.get("role") != "system"]
    kwargs: dict = {
        "model": DEFAULT_CLAUDE_MODEL,
        "max_tokens": 2048,
        "messages": user_messages,
    }
    if system:
        kwargs["system"] = system
    elif any(m.get("role") == "system" for m in messages):
        # Extract system content from messages list
        sys_content = " ".join(
            m.get("content", "") for m in messages if m.get("role") == "system"
        )
        kwargs["system"] = sys_content

    response = await client.messages.create(**kwargs)
    return response.content[0].text if response.content else ""


async def _call_ai(messages: list[dict], model: str, system: str | None = None) -> str:
    """Call Anthropic if key available, else Ollama."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return await _call_anthropic(messages, system)
        except Exception as exc:
            logger.warning("Anthropic chat failed, falling back to Ollama: %s", exc)

    # Ollama fallback
    all_messages = list(messages)
    if system and (not all_messages or all_messages[0].get("role") != "system"):
        all_messages = [{"role": "system", "content": system}] + all_messages
    return await call_ollama_chat(all_messages, model)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """General chat with AI assistant."""
    messages = [m.model_dump() for m in data.messages]
    text = await _call_ai(messages, data.model, system=BASE_SYSTEM)
    return ChatResponse(
        message=ChatMessage(role="assistant", content=text),
        model=data.model,
    )


@router.post("/plan-chat", response_model=ChatResponse)
async def plan_chat(
    data: PlanChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Smart content planning chat — knows user's connected accounts."""
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.is_active == True,
        )
    )
    raw_accounts = result.scalars().all()
    accounts = [
        {"platform": a.platform, "account_name": a.account_name}
        for a in raw_accounts
    ]

    system_prompt = build_system_with_accounts(accounts)
    messages = [m.model_dump() for m in data.messages]
    messages = [m for m in messages if m.get("role") != "system"]

    text = await _call_ai(messages, data.model, system=system_prompt)
    return ChatResponse(
        message=ChatMessage(role="assistant", content=text),
        model=data.model,
    )


@router.get("/models")
async def list_models(
    current_user: User = Depends(get_current_user),
):
    """List available AI models."""
    settings = get_settings()

    if settings.anthropic_api_key:
        return {
            "models": ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"],
            "default": "claude-haiku-4-5-20251001",
            "status": "ok",
            "provider": "anthropic",
        }

    if settings.openrouter_api_key:
        return {
            "models": [settings.openrouter_model, "openrouter/free"],
            "default": settings.openrouter_model,
            "status": "ok",
            "provider": "openrouter",
        }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{ollama_url()}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                if models:
                    return {
                        "models": models,
                        "default": models[0],
                        "status": "ok",
                        "provider": "ollama",
                    }
        return {
            "models": [DEFAULT_OLLAMA_MODEL],
            "default": DEFAULT_OLLAMA_MODEL,
            "status": "offline",
            "provider": "ollama",
        }
    except Exception:
        return {
            "models": [DEFAULT_OLLAMA_MODEL],
            "default": DEFAULT_OLLAMA_MODEL,
            "status": "offline",
            "provider": "none",
        }
