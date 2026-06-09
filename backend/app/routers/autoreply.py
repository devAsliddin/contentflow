"""V4 — Auto-reply rules CRUD + logs. All endpoints enforce account/rule ownership."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.account import Account
from app.models.autoreply import AutoReplyRule, AutoReplyLog
from app.schemas.autoreply import (
    AutoReplyRuleCreate, AutoReplyRuleUpdate, AutoReplyRuleOut, AutoReplyLogOut,
)
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


async def _owned_account(db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _owned_rule(db: AsyncSession, user_id: uuid.UUID, rule_id: uuid.UUID) -> AutoReplyRule:
    result = await db.execute(
        select(AutoReplyRule).where(
            AutoReplyRule.id == rule_id, AutoReplyRule.user_id == user_id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.get("/accounts/{account_id}/autoreply-rules", response_model=list[AutoReplyRuleOut])
async def list_rules(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_account(db, current_user.id, account_id)
    result = await db.execute(
        select(AutoReplyRule)
        .where(AutoReplyRule.account_id == account_id)
        .order_by(AutoReplyRule.priority.desc(), AutoReplyRule.created_at.desc())
    )
    return [AutoReplyRuleOut.model_validate(r) for r in result.scalars().all()]


@router.post(
    "/accounts/{account_id}/autoreply-rules",
    response_model=AutoReplyRuleOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    account_id: uuid.UUID,
    data: AutoReplyRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_account(db, current_user.id, account_id)
    rule = AutoReplyRule(
        account_id=account_id,
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return AutoReplyRuleOut.model_validate(rule)


@router.patch("/autoreply-rules/{rule_id}", response_model=AutoReplyRuleOut)
async def update_rule(
    rule_id: uuid.UUID,
    data: AutoReplyRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _owned_rule(db, current_user.id, rule_id)

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field == "keywords" and value is not None:
            value = [k.strip() for k in value if k and k.strip()]
        setattr(rule, field, value)

    # Re-validate cross-field invariants on the merged state.
    if rule.match_type != "any" and not rule.keywords:
        raise HTTPException(status_code=422, detail="keywords required unless match_type is 'any'")
    if rule.target == "comment" and rule.comment_action is None:
        rule.comment_action = "reply_public"
    if rule.target == "dm":
        rule.comment_action = None

    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return AutoReplyRuleOut.model_validate(rule)


@router.delete("/autoreply-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _owned_rule(db, current_user.id, rule_id)
    await db.delete(rule)


@router.get("/accounts/{account_id}/autoreply-logs", response_model=list[AutoReplyLogOut])
async def list_logs(
    account_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_account(db, current_user.id, account_id)
    result = await db.execute(
        select(AutoReplyLog)
        .where(AutoReplyLog.account_id == account_id)
        .order_by(AutoReplyLog.created_at.desc())
        .limit(limit)
    )
    return [AutoReplyLogOut.model_validate(r) for r in result.scalars().all()]
