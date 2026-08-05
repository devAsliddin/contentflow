"""Meta (Facebook/Instagram) data-privacy callbacks.

Meta requires two POST callbacks for an app that goes Live with user data:

  * Deauthorize callback   — fired when a user removes the app.
  * Data Deletion callback — fired when a user requests deletion of their data.

Both receive a signed ``signed_request`` form field (``<sig>.<payload>``,
base64url) that we verify with the app secret (HMAC-SHA256). The data-deletion
endpoint must answer with JSON ``{"url": ..., "confirmation_code": ...}`` so the
user can track the request — this is what Meta polls during App Review.

The connected-account credentials are the only user data ContentFlow stores for
a Meta user, and erasure is processed by an admin (see information/META_GO_LIVE.md);
these callbacks verify + record the request rather than issuing destructive
deletes against live data automatically.
"""

import base64
import hashlib
import hmac
import json
import logging
import time

from fastapi import APIRouter, Form, HTTPException, Request

from app.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


def _b64url_decode(segment: str) -> bytes:
    """Decode a base64url segment, tolerating missing padding."""
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def parse_signed_request(signed_request: str) -> dict:
    """Verify a Meta ``signed_request`` and return its decoded payload.

    Raises HTTP 400 on a malformed request and 403 on a bad signature.
    """
    secret = settings.meta_app_secret_resolved
    if not secret:
        logger.error("META_APP_SECRET not configured — cannot verify signed_request")
        raise HTTPException(status_code=500, detail="app secret not configured")

    try:
        encoded_sig, encoded_payload = signed_request.split(".", 1)
        sig = _b64url_decode(encoded_sig)
        payload = json.loads(_b64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Malformed signed_request: %s", exc)
        raise HTTPException(status_code=400, detail="malformed signed_request")

    if str(payload.get("algorithm", "")).upper() != "HMAC-SHA256":
        raise HTTPException(status_code=400, detail="unexpected algorithm")

    expected = hmac.new(
        secret.encode("utf-8"), encoded_payload.encode("utf-8"), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(expected, sig):
        logger.warning("signed_request signature mismatch")
        raise HTTPException(status_code=403, detail="bad signature")

    return payload


@router.post("/deauthorize")
async def deauthorize(request: Request, signed_request: str = Form(default="")):
    """Meta fires this when a user removes the app. Ack with 200."""
    if not signed_request:
        # Meta sometimes probes with an empty body; accept quietly.
        return {"status": "ok"}
    payload = parse_signed_request(signed_request)
    user_id = payload.get("user_id", "unknown")
    logger.info("Meta deauthorize callback for user_id=%s", user_id)
    return {"status": "ok"}


@router.post("/data-deletion")
async def data_deletion(request: Request, signed_request: str = Form(default="")):
    """Meta data-deletion request callback.

    Returns the tracking URL + confirmation code Meta expects. The actual
    erasure of the stored connected-account credentials is processed by an
    admin against ``confirmation_code``.
    """
    payload = parse_signed_request(signed_request)
    user_id = payload.get("user_id", "unknown")

    # A stable, non-secret code the user can quote to check deletion status.
    confirmation_code = f"cf-del-{user_id}-{int(time.time())}"
    logger.info(
        "Meta data-deletion request user_id=%s confirmation_code=%s",
        user_id,
        confirmation_code,
    )

    base = settings.frontend_url.rstrip("/") or "https://postix.uz"
    return {
        "url": f"{base}/data-deletion?code={confirmation_code}",
        "confirmation_code": confirmation_code,
    }
