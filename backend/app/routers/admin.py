from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.account import Account
from app.middleware.auth_middleware import get_current_admin

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None
    full_name: str | None = None


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_posts: int
    total_accounts: int


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar_one()
    total_posts = (await db.execute(select(func.count()).select_from(Post))).scalar_one()
    total_accounts = (await db.execute(select(func.count()).select_from(Account))).scalar_one()
    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_posts=total_posts,
        total_accounts=total_accounts,
    )


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return [AdminUserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user.id == admin.id and data.is_admin is False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin rights")

    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.full_name is not None:
        user.full_name = data.full_name

    db.add(user)
    await db.flush()
    await db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.flush()


@router.get("/posts", response_model=list[dict])
async def list_all_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(
            Post.id, Post.user_id, Post.caption, Post.status,
            Post.platforms, Post.scheduled_at, Post.created_at,
        )
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]
