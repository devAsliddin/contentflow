"""V4 — Instagram webhook receiver (DM + comment events).

GET  = Meta verification handshake.
POST = event delivery. We verify the X-Hub-Signature-256 signature, return 200
       immediately, and hand off heavy work to Celery.
"""
import hmac
import hashlib
import logging

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


@router.get("/instagram")
async def verify_webhook(request: Request):
    """Meta verification handshake — echo hub.challenge if the token matches."""
    params = request.query_params
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == settings.instagram_webhook_verify_token
    ):
        return PlainTextResponse(params.get("hub.challenge", ""), status_code=200)
    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/instagram")
async def receive_webhook(request: Request):
    """Receive an event: verify signature, ack 200 fast, enqueue Celery task."""
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    secret = settings.meta_app_secret_resolved
    if not secret:
        logger.error("META_APP_SECRET not configured — rejecting webhook")
        raise HTTPException(status_code=403, detail="Not configured")

    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        logger.warning("Instagram webhook signature mismatch")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Parse JSON only after the signature is verified.
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return PlainTextResponse("OK", status_code=200)

    # Enqueue async — never block the webhook response.
    try:
        from app.tasks.instagram_autoreply import process_instagram_event
        process_instagram_event.delay(payload)
    except Exception as exc:  # noqa: BLE001
        # Even if enqueue fails we must return 200 so Meta doesn't disable the hook;
        # the error is logged for investigation.
        logger.exception("Failed to enqueue Instagram event: %s", exc)

    return PlainTextResponse("OK", status_code=200)
