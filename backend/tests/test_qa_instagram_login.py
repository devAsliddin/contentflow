"""QA — Instagram username/password connect flow (accounts/instagram/login).

Covers the login fix: real instagrapi login + session storage, conditional 2FA
(only asked when the account actually has it), and challenge handling.
"""
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient

from app.services.instagram_service import InstagramTwoFactorRequired
from app.services.encryption import decrypt_credentials
import app.services.instagram_service as ig_service


LOGIN_URL = "/api/v1/accounts/instagram/login"


@pytest.mark.asyncio
async def test_login_success_stores_session(async_client: AsyncClient, db):
    """A successful login persists ig_session + ig_user_id, never the password."""
    fake = MagicMock(return_value={
        "session": {"uuids": {"phone_id": "x"}, "authorization_data": {"ds_user_id": "999"}},
        "user_id": "999",
        "username": "contentflow_agent",
    })
    with patch.object(ig_service, "instagram_login", fake):
        resp = await async_client.post(
            LOGIN_URL,
            json={"username": "contentflow_agent", "password": "secret"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["platform"] == "instagram"
    assert body["account_name"] == "contentflow_agent"

    # The stored credentials must contain the session and NOT the raw password.
    from sqlalchemy import select
    from app.models.account import Account
    row = (await db.execute(select(Account).where(Account.account_name == "contentflow_agent"))).scalar_one()
    creds = decrypt_credentials(row.credentials)
    assert "ig_session" in creds
    assert creds["ig_user_id"] == "999"
    assert "ig_password" not in creds


@pytest.mark.asyncio
async def test_login_two_factor_returns_409(async_client: AsyncClient):
    """When 2FA is required, the API signals 409 so the UI can reveal the code field."""
    fake = MagicMock(side_effect=InstagramTwoFactorRequired("2FA code required"))
    with patch.object(ig_service, "instagram_login", fake):
        resp = await async_client.post(
            LOGIN_URL,
            json={"username": "u", "password": "p"},
        )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "two_factor_required"


@pytest.mark.asyncio
async def test_login_challenge_returns_400(async_client: AsyncClient):
    """A device/IP challenge surfaces as a clear 400 (not a silent success)."""
    fake = MagicMock(side_effect=ValueError(
        "Instagram requires verification. Open the Instagram app on your phone."
    ))
    with patch.object(ig_service, "instagram_login", fake):
        resp = await async_client.post(
            LOGIN_URL,
            json={"username": "u", "password": "p"},
        )
    assert resp.status_code == 400
    assert "verification" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_passes_verification_code(async_client: AsyncClient):
    """A submitted 2FA code is forwarded to the login service."""
    fake = MagicMock(return_value={"session": {}, "user_id": "1", "username": "u"})
    with patch.object(ig_service, "instagram_login", fake):
        await async_client.post(
            LOGIN_URL,
            json={"username": "u", "password": "p", "verification_code": "123456"},
        )
    # third positional arg is the verification code
    assert fake.call_args.args[2] == "123456"
