"""V6 — Shared AI reply helper for Instagram and Facebook auto-reply.

generate_ai_reply(account, rule, comment_text, post_context) -> str | None

Strategy:
  - Fetch latest 'ready' account profile for brand tone (or use neutral tone).
  - Build a system prompt with guardrails: business topic only, no pricing promises,
    skip spam/insults (reply=None).
  - Call complete_json_validated("content", schema=_AiReplyResult).
  - If skip=True or any failure: return None.
  - Truncate reply to ≤300 characters.
"""
from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_MAX_REPLY_LENGTH = 300

_GUARDRAIL_SYSTEM = (
    "You are a professional social media community manager responding to a comment on behalf of a business. "
    "Rules you MUST follow:\n"
    "1. ONLY respond to business-related topics (products, services, questions about the business).\n"
    "2. Do NOT make pricing promises, discount commitments, or contractual claims.\n"
    "3. If the comment is spam, offensive, contains insults, or is clearly off-topic/irrelevant, "
    "set skip=true.\n"
    "4. Keep the reply friendly, professional, and ≤300 characters.\n"
    "5. Return ONLY a JSON object: {\"reply\": \"...\", \"skip\": false}\n"
    "   or {\"reply\": \"\", \"skip\": true} if you should skip.\n"
    "No markdown fences, no extra text."
)


class _AiReplyResult(BaseModel):
    reply: str = Field(default="")
    skip: bool = Field(default=False)


async def generate_ai_reply(
    account,
    rule,
    comment_text: str,
    post_context: Optional[str] = None,
) -> Optional[str]:
    """Generate an AI reply for a comment.

    Args:
        account:      Account ORM instance (used to fetch profile tone).
        rule:         AutoReplyRule ORM instance (rule.ai_context appended to context).
        comment_text: The incoming comment text.
        post_context: Optional post caption / context string for better replies.

    Returns:
        Reply string (≤300 chars) or None if should be skipped / AI unavailable.
    """
    from app.services.ai.json_utils import complete_json_validated

    # ── Build tone block from account profile (best-effort) ──────────────────
    tone_block = ""
    try:
        tone_block = await _get_profile_tone(account)
    except Exception as exc:  # noqa: BLE001
        logger.debug("ai_reply: could not fetch profile tone account_id=%s: %s", account.id, exc)

    # ── Build prompt ──────────────────────────────────────────────────────────
    system_parts: list[str] = [_GUARDRAIL_SYSTEM]
    if tone_block:
        system_parts.append(f"\nBrand tone context:\n{tone_block}")
    if rule.ai_context:
        system_parts.append(f"\nAdditional reply context:\n{rule.ai_context}")

    system = "\n".join(system_parts)

    prompt_parts: list[str] = []
    if post_context:
        prompt_parts.append(f"Post context: {post_context[:300]}")
    prompt_parts.append(f"Comment to reply to: {comment_text}")
    prompt_parts.append("\nGenerate a reply now.")

    prompt = "\n".join(prompt_parts)

    try:
        result: _AiReplyResult = await complete_json_validated(
            "content",
            system=system,
            prompt=prompt,
            schema=_AiReplyResult,
            max_tokens=400,
            temperature=0.4,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_reply: AI call failed account_id=%s: %s", account.id, exc)
        return None

    if result.skip or not result.reply.strip():
        logger.debug(
            "ai_reply: skip=True or empty reply for account_id=%s comment=%r",
            account.id, comment_text[:80],
        )
        return None

    # Truncate to 300 chars
    reply = result.reply.strip()
    if len(reply) > _MAX_REPLY_LENGTH:
        reply = reply[:_MAX_REPLY_LENGTH]

    return reply


async def _get_profile_tone(account) -> str:
    """Return a short tone description from the latest ready account profile.

    Returns empty string if no profile is available.
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with factory() as db:
            from app.models.analysis import AccountProfile  # noqa: PLC0415

            result = await db.execute(
                select(AccountProfile)
                .where(
                    AccountProfile.account_id == account.id,
                    AccountProfile.status == "ready",
                )
                .order_by(AccountProfile.version.desc())
                .limit(1)
            )
            profile = result.scalar_one_or_none()
            if not profile or not profile.profile_json:
                return ""

            pj = profile.profile_json
            niche = pj.get("niche", "")
            tone_info = pj.get("tone_of_voice", {})
            primary_tone = tone_info.get("primary", "") if isinstance(tone_info, dict) else ""
            tone_desc = tone_info.get("description", "") if isinstance(tone_info, dict) else ""
            summary = pj.get("summary_one_liner", "")

            parts = []
            if niche:
                parts.append(f"Niche: {niche}")
            if primary_tone:
                parts.append(f"Tone: {primary_tone}")
            if tone_desc:
                parts.append(f"Tone description: {tone_desc}")
            if summary:
                parts.append(f"Brand summary: {summary}")

            return ". ".join(parts)
    except Exception as exc:  # noqa: BLE001
        logger.debug("ai_reply: profile DB lookup failed: %s", exc)
        return ""
    finally:
        await engine.dispose()
