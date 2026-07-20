"""V6 — Facebook webhook receiver (Page feed / comment events).

GET  /facebook  = Meta verification handshake (hub.verify_token check).
POST /facebook  = event delivery. HMAC-SHA256 verified, 200 returned immediately,
                  payload enqueued to Celery default queue.
"""
import hmac
import hashlib
import logging

from app.tasks.enqueue import fire_and_forget

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


@router.get("/facebook", summary="Facebook webhook verification")
async def verify_facebook_webhook(request: Request):
    """Meta verification handshake — echo hub.challenge if the token matches."""
    params = request.query_params
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == settings.fb_webhook_verify_token
    ):
        return PlainTextResponse(params.get("hub.challenge", ""), status_code=200)
    logger.warning("fb_webhook: verify failed — token mismatch or wrong mode")
    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/facebook", summary="Facebook webhook event delivery")
async def receive_facebook_webhook(request: Request):
    """Receive event: verify HMAC signature, ack 200 fast, enqueue Celery task."""
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    secret = settings.fb_app_secret_resolved
    if not secret:
        logger.error("fb_webhook: FB_APP_SECRET not configured — rejecting webhook")
        raise HTTPException(status_code=403, detail="Not configured")

    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        logger.warning("fb_webhook: signature mismatch")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Parse JSON only after signature is verified
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return PlainTextResponse("OK", status_code=200)

    # Enqueue detached — .delay() is blocking broker I/O and would stall the
    # webhook response ~20s if the broker is down, which can make Meta disable
    # the hook. Fire it on a background task and return 200 immediately.
    def _enqueue() -> None:
        from app.tasks.facebook_autoreply import process_facebook_event  # noqa: PLC0415
        process_facebook_event.delay(payload)

    fire_and_forget(_enqueue, label="facebook_event")

    return PlainTextResponse("OK", status_code=200)
