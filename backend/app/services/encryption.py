"""Fernet encryption for storing platform credentials."""
import json
import hashlib
import base64
from cryptography.fernet import Fernet
from app.config import get_settings


def _get_fernet() -> Fernet:
    settings = get_settings()
    if settings.encryption_key:
        # Use the dedicated ENCRYPTION_KEY from env (preferred in production).
        # Must be a valid Fernet key (32 url-safe base64 bytes).
        key = settings.encryption_key.encode()
    else:
        # Fallback for development: derive a stable 32-byte key from SECRET_KEY
        # using SHA-256 so it works regardless of SECRET_KEY length.
        raw = hashlib.sha256(settings.secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_credentials(credentials: dict) -> str:
    f = _get_fernet()
    return f.encrypt(json.dumps(credentials).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    f = _get_fernet()
    return json.loads(f.decrypt(encrypted.encode()).decode())
