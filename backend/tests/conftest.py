"""pytest fixtures for ContentFlow V2 backend tests."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database import get_db, Base
from app.models.user import User
from app.models.account import Account
from app.models.post import Post, PostLog
from app.models.post_template import PostTemplate
from app.middleware.auth_middleware import get_current_user

# ─── In-memory SQLite for tests ───────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(engine):
    """Per-test async database session with rollback."""
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def test_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="$2b$12$fakehash",
        full_name="Test User",
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_account(db: AsyncSession, test_user: User) -> Account:
    acc = Account(
        id=uuid.uuid4(),
        user_id=test_user.id,
        platform="telegram",
        account_name="test_channel",
        credentials='{"bot_token": "fake_token", "channel_id": "@fake_channel"}',
        is_active=True,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


@pytest_asyncio.fixture
async def test_post(db: AsyncSession, test_user: User, test_account: Account) -> Post:
    post = Post(
        id=uuid.uuid4(),
        user_id=test_user.id,
        caption="Test post caption #test",
        media_url=None,
        media_type=None,
        platforms=[f"telegram:{test_account.id}"],
        platform_options={},
        status="draft",
        scheduled_at=None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@pytest_asyncio.fixture
async def published_post(db: AsyncSession, test_user: User, test_account: Account) -> Post:
    post = Post(
        id=uuid.uuid4(),
        user_id=test_user.id,
        caption="Published post caption",
        media_url=None,
        media_type=None,
        platforms=[f"telegram:{test_account.id}"],
        platform_options={},
        status="published",
        scheduled_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@pytest_asyncio.fixture
async def test_post_log(db: AsyncSession, published_post: Post, test_account: Account) -> PostLog:
    log = PostLog(
        id=uuid.uuid4(),
        post_id=published_post.id,
        account_id=test_account.id,
        platform="telegram",
        status="success",
        external_id="123456",
        executed_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@pytest.fixture
def override_db(db: AsyncSession):
    """Override the FastAPI get_db dependency with test session."""
    async def _get_db():
        yield db
    return _get_db


@pytest.fixture
def override_user(test_user: User):
    """Override the FastAPI get_current_user dependency with test user."""
    async def _get_current_user():
        return test_user
    return _get_current_user


@pytest_asyncio.fixture
async def async_client(db: AsyncSession, test_user: User):
    """Async test client with auth and DB overrides."""
    async def _get_db():
        yield db

    async def _get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = _get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
