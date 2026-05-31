"""AUTH QA: Comprehensive authentication endpoint tests.

Covers: register, login, refresh, /me GET, /me PUT
All edge cases: duplicate email, weak password, wrong credentials,
disabled account, token type misuse, malformed tokens.
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database import get_db, Base
from app.models.user import User
from app.middleware.auth_middleware import hash_password, create_access_token, create_refresh_token


# ─── Shared constants ──────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

VALID_PASSWORD = "SecurePass1!"
VALID_EMAIL = "auth_test@example.com"
VALID_PAYLOAD = {"email": VALID_EMAIL, "password": VALID_PASSWORD, "full_name": "Auth Tester"}


# ─── Fixtures ─────────────────────────────────────────────────────────────────

async def _make_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


@pytest.fixture
async def auth_db():
    """Fresh in-memory DB per test — no shared state between tests."""
    engine = await _make_engine()
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.fixture
async def auth_client(auth_db: AsyncSession):
    """
    Raw HTTP client with real auth logic.
    Rate limiter is bypassed by providing unique IPs per request.
    """
    async def _get_db():
        yield auth_db

    app.dependency_overrides[get_db] = _get_db

    # Disable rate limiting for tests — the limiter is module-level in auth.py
    import app.routers.auth as auth_module
    original = auth_module.limiter.enabled
    auth_module.limiter.enabled = False
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        auth_module.limiter.enabled = original

    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def registered_user(auth_client: AsyncClient):
    """Pre-register a user and return the auth response JSON."""
    resp = await auth_client.post("/api/v1/auth/register", json=VALID_PAYLOAD)
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    return resp.json()


# ─── REGISTER ─────────────────────────────────────────────────────────────────

async def test_register_success(auth_client: AsyncClient):
    """Happy path: new user registers and gets tokens back."""
    resp = await auth_client.post("/api/v1/auth/register", json=VALID_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    user = data["user"]
    assert user["email"] == VALID_EMAIL
    assert user["full_name"] == "Auth Tester"
    assert user["is_active"] is True
    assert "hashed_password" not in user  # never leak password hash


async def test_register_duplicate_email(auth_client: AsyncClient, registered_user):
    """Registering with an already-used email returns 400."""
    resp = await auth_client.post("/api/v1/auth/register", json=VALID_PAYLOAD)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


async def test_register_email_case_insensitive(auth_client: AsyncClient, registered_user):
    """Email uniqueness is case-insensitive (schema normalizes to lowercase)."""
    payload = {**VALID_PAYLOAD, "email": VALID_EMAIL.upper()}
    resp = await auth_client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 400


async def test_register_invalid_email(auth_client: AsyncClient):
    """Malformed email is rejected at schema validation level."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": VALID_PASSWORD},
    )
    assert resp.status_code == 422


async def test_register_password_too_short(auth_client: AsyncClient):
    """Password < 8 chars is rejected."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": "Ab1!"},
    )
    assert resp.status_code == 422


async def test_register_password_no_uppercase(auth_client: AsyncClient):
    """Password without an uppercase letter is rejected."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": "lowercase1!"},
    )
    assert resp.status_code == 422


async def test_register_password_no_digit(auth_client: AsyncClient):
    """Password without a digit is rejected."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": "NoDigit!abc"},
    )
    assert resp.status_code == 422


async def test_register_password_no_special_char(auth_client: AsyncClient):
    """Password without a special character is rejected."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": "NoSpecial1abc"},
    )
    assert resp.status_code == 422


async def test_register_full_name_too_short(auth_client: AsyncClient):
    """Full name under 2 chars is rejected."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "new@test.com", "password": VALID_PASSWORD, "full_name": "A"},
    )
    assert resp.status_code == 422


async def test_register_full_name_optional(auth_client: AsyncClient):
    """Registering without full_name is allowed."""
    resp = await auth_client.post(
        "/api/v1/auth/register",
        json={"email": "nofullname@test.com", "password": VALID_PASSWORD},
    )
    assert resp.status_code == 201
    assert resp.json()["user"]["full_name"] is None


# ─── LOGIN ────────────────────────────────────────────────────────────────────

async def test_login_success(auth_client: AsyncClient, registered_user):
    """Happy path: correct credentials return tokens."""
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": VALID_EMAIL, "password": VALID_PASSWORD},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == VALID_EMAIL


async def test_login_wrong_password(auth_client: AsyncClient, registered_user):
    """Wrong password returns 401."""
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": VALID_EMAIL, "password": "WrongPass1!"},
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


async def test_login_nonexistent_user(auth_client: AsyncClient):
    """Nonexistent email returns 401 — same message as wrong password (no user enumeration)."""
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@test.com", "password": VALID_PASSWORD},
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


async def test_login_disabled_account(auth_client: AsyncClient, auth_db: AsyncSession):
    """Disabled accounts are rejected with 403."""
    user = User(
        id=uuid.uuid4(),
        email="disabled@test.com",
        hashed_password=hash_password(VALID_PASSWORD),
        full_name="Disabled",
        is_active=False,
    )
    auth_db.add(user)
    await auth_db.commit()

    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "disabled@test.com", "password": VALID_PASSWORD},
    )
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()


async def test_login_email_case_insensitive(auth_client: AsyncClient, registered_user):
    """Login with uppercase email still works (schema normalizes to lowercase)."""
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": VALID_EMAIL.upper(), "password": VALID_PASSWORD},
    )
    assert resp.status_code == 200


async def test_login_empty_password(auth_client: AsyncClient, registered_user):
    """Empty password is rejected (401 — fails verify)."""
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": VALID_EMAIL, "password": ""},
    )
    assert resp.status_code in (401, 422)


# ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

async def test_refresh_success(auth_client: AsyncClient, registered_user):
    """Valid refresh token issues new access + refresh tokens."""
    refresh_token = registered_user["refresh_token"]
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == VALID_EMAIL


async def test_refresh_with_access_token_fails(auth_client: AsyncClient, registered_user):
    """Using an access token where refresh is expected returns 401."""
    access_token = registered_user["access_token"]
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert resp.status_code == 401
    assert "token type" in resp.json()["detail"].lower()


async def test_refresh_malformed_token(auth_client: AsyncClient):
    """Completely invalid token string returns 401."""
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "this.is.not.a.token"},
    )
    assert resp.status_code == 401


async def test_refresh_empty_token(auth_client: AsyncClient):
    """Empty refresh token returns 422 (schema) or 401."""
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": ""},
    )
    assert resp.status_code in (401, 422)


# ─── GET /me ──────────────────────────────────────────────────────────────────

async def test_get_me_success(auth_client: AsyncClient, registered_user):
    """Authenticated user can fetch their own profile."""
    access_token = registered_user["access_token"]
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == VALID_EMAIL
    assert data["full_name"] == "Auth Tester"
    assert "hashed_password" not in data


async def test_get_me_unauthorized(auth_client: AsyncClient):
    """No token → 401 (HTTPBearer requires credentials)."""
    resp = await auth_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_get_me_invalid_token(auth_client: AsyncClient):
    """Garbage token → 401."""
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer garbage.token.here"},
    )
    assert resp.status_code == 401


async def test_get_me_refresh_token_rejected(auth_client: AsyncClient, registered_user):
    """Using a refresh token on a protected endpoint returns 401 (wrong token type)."""
    refresh_token = registered_user["refresh_token"]
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 401
    assert "token type" in resp.json()["detail"].lower()


async def test_get_me_inactive_user_token(auth_client: AsyncClient, auth_db: AsyncSession):
    """Token for a disabled user is rejected even if the token itself is valid."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="inactive_token@test.com",
        hashed_password=hash_password(VALID_PASSWORD),
        is_active=False,
    )
    auth_db.add(user)
    await auth_db.commit()

    token = create_access_token(user_id)
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


# ─── PUT /me ──────────────────────────────────────────────────────────────────

async def test_update_me_success(auth_client: AsyncClient, registered_user):
    """Authenticated user can update their full_name."""
    access_token = registered_user["access_token"]
    resp = await auth_client.put(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"full_name": "Updated Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Name"


async def test_update_me_clear_name(auth_client: AsyncClient, registered_user):
    """Sending full_name: null clears the field."""
    access_token = registered_user["access_token"]
    resp = await auth_client.put(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"full_name": None},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] is None


async def test_update_me_empty_body(auth_client: AsyncClient, registered_user):
    """Empty update body is a no-op — user data unchanged."""
    access_token = registered_user["access_token"]
    resp = await auth_client.put(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        json={},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == VALID_EMAIL


async def test_update_me_unauthorized(auth_client: AsyncClient):
    """No token → 401."""
    resp = await auth_client.put("/api/v1/auth/me", json={"full_name": "Hacker"})
    assert resp.status_code == 401


# ─── FULL FLOW ─────────────────────────────────────────────────────────────────

async def test_full_auth_flow(auth_client: AsyncClient):
    """End-to-end: register → login → /me → refresh → /me with new token."""
    # 1. Register
    reg = await auth_client.post("/api/v1/auth/register", json={
        "email": "flow_test@example.com",
        "password": VALID_PASSWORD,
        "full_name": "Flow Tester",
    })
    assert reg.status_code == 201
    access = reg.json()["access_token"]
    refresh = reg.json()["refresh_token"]

    # 2. Login with same credentials
    login = await auth_client.post("/api/v1/auth/login", json={
        "email": "flow_test@example.com",
        "password": VALID_PASSWORD,
    })
    assert login.status_code == 200

    # 3. Access protected endpoint with original access token
    me = await auth_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json()["email"] == "flow_test@example.com"

    # 4. Refresh
    refreshed = await auth_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert refreshed.status_code == 200
    new_access = refreshed.json()["access_token"]

    # 5. New access token works
    me2 = await auth_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me2.status_code == 200
    assert me2.json()["email"] == "flow_test@example.com"
