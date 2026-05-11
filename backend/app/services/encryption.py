"""Simple Fernet encryption for storing platform credentials."""
import json
import base64
from cryptography.fernet import Fernet
from app.config import get_settings


def _get_fernet() -> Fernet:
    settings = get_settings()
    # Derive a 32-byte key from SECRET_KEY
    key_bytes = settings.secret_key.encode()[:32].ljust(32, b"0")
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_credentials(credentials: dict) -> str:
    f = _get_fernet()
    return f.encrypt(json.dumps(credentials).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    f = _get_fernet()
    return json.loads(f.decrypt(encrypted.encode()).decode())
