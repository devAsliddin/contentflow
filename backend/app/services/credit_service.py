"""AI credit accounting.

Every user-facing AI action costs a fixed number of credits. Credits are
deducted from ``User.ai_credits`` at the point of use. The request-scoped DB
session (see ``app.database.get_db``) commits on success and rolls back on any
exception — so if an AI call raises after we deduct, the deduction is reverted
automatically and the user is not charged for a failed generation.

Admins are unlimited (never charged).
"""
import logging

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

# ── Cost tiers ────────────────────────────────────────────────────────────────
COST_TEXT = 1     # one short text generation (caption, hashtags, single chat turn)
COST_BATCH = 3    # multi-item generation (batch captions, A/B variants)
COST_VISION = 2   # image-based / vision generation
COST_PLAN = 5     # full weekly content plan
COST_IMAGE = 10   # AI image generation

# Feature key → credit cost. Unknown keys fall back to COST_TEXT.
COSTS: dict[str, int] = {
    "chat": COST_TEXT,
    "plan_chat": COST_TEXT,
    "agent_chat": COST_TEXT,
    "caption": COST_TEXT,
    "caption_image": COST_VISION,
    "captions_batch": COST_BATCH,
    "plan": COST_PLAN,
    "plan_v2": COST_PLAN,
    "ab_captions": COST_BATCH,
    "ideas": COST_TEXT,
    "content_ideas": COST_TEXT,
    "rewrite": COST_TEXT,
    "hashtags": COST_TEXT,
    "tone": COST_TEXT,
    "image": COST_IMAGE,
    "post_generate": COST_BATCH,
}


class InsufficientCreditsError(HTTPException):
    def __init__(self, needed: int, have: int):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"AI kreditlaringiz yetarli emas — kerak {needed}, mavjud {have}.",
        )


def cost_for(feature: str) -> int:
    return COSTS.get(feature, COST_TEXT)


async def consume(db: AsyncSession, user: User, feature: str, units: int = 1) -> int:
    """Deduct credits for ``feature``. Returns the remaining balance.

    Raises ``InsufficientCreditsError`` (HTTP 402) when the balance is too low.
    Admins are never charged.

    The deduction is a single conditional UPDATE (WHERE ai_credits >= cost)
    rather than check-then-write on the in-memory ``user`` object: two
    concurrent requests from the same user (e.g. two chat tabs, or a
    double-click) both reading the same starting balance could otherwise
    both pass the check and both deduct, letting the balance go negative.
    The UPDATE is atomic at the database level regardless of concurrency.
    """
    cost = cost_for(feature) * max(1, units)
    if user.is_admin:
        return user.ai_credits

    result = await db.execute(
        update(User)
        .where(User.id == user.id, User.ai_credits >= cost)
        .values(ai_credits=User.ai_credits - cost)
        .returning(User.ai_credits)
    )
    row = result.first()
    if row is None:
        # Either genuinely insufficient, or another concurrent request just
        # spent the balance first — re-read for an accurate error message.
        await db.refresh(user)
        raise InsufficientCreditsError(cost, user.ai_credits)

    user.ai_credits = row[0]
    logger.info(
        "credits: user=%s -%d (%s) remaining=%d", user.id, cost, feature, user.ai_credits
    )
    return user.ai_credits


async def refund(db: AsyncSession, user: User, feature: str, units: int = 1) -> int:
    """Give back credits previously consumed (e.g. async job failed). Capped at limit."""
    cost = cost_for(feature) * max(1, units)
    if user.is_admin:
        return user.ai_credits
    user.ai_credits = min(user.ai_credits + cost, user.ai_credits_limit) \
        if user.ai_credits_limit else user.ai_credits + cost
    db.add(user)
    await db.flush()
    return user.ai_credits


async def add_credits(db: AsyncSession, user: User, amount: int) -> int:
    """Admin: add (or remove, if negative) credits. Never drops below 0."""
    user.ai_credits = max(0, user.ai_credits + amount)
    if user.ai_credits > user.ai_credits_limit:
        user.ai_credits_limit = user.ai_credits
    db.add(user)
    await db.flush()
    return user.ai_credits


async def set_credits(
    db: AsyncSession, user: User, credits: int | None = None, limit: int | None = None
) -> User:
    """Admin: set absolute balance and/or limit."""
    if limit is not None:
        user.ai_credits_limit = max(0, limit)
    if credits is not None:
        user.ai_credits = max(0, credits)
    # Keep balance within the limit ceiling.
    if user.ai_credits > user.ai_credits_limit:
        user.ai_credits_limit = user.ai_credits
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
