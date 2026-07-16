import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from .config import settings

# ---- password hashing (stdlib scrypt) ----

_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_SCRYPT_DKLEN
    )
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(derived).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_b64, hash_b64 = stored.split("$", 2)
    except ValueError:
        return False
    if algo != "scrypt":
        return False
    try:
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except Exception:
        return False
    derived = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=len(expected)
    )
    return hmac.compare_digest(derived, expected)


# ---- signed stateless session tokens (HMAC-SHA256) ----

_SESSION_TTL = 60 * 60 * 24 * 7  # 7 days


def _b64_url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64_url(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(payload_b64: str) -> str:
    sig = hmac.new(settings.secret_key.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return _b64_url(sig)


def create_session_token(user_id: int, ttl_seconds: int = _SESSION_TTL) -> str:
    now = int(time.time())
    payload = {"uid": user_id, "iat": now, "exp": now + ttl_seconds}
    payload_b64 = _b64_url(json.dumps(payload, separators=(",", ":")).encode())
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_session_token(token: str) -> Optional[dict]:
    if not token or "." not in token:
        return None
    payload_b64, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(payload_b64)):
        return None
    try:
        payload = json.loads(_unb64_url(payload_b64).decode())
    except Exception:
        return None
    if not isinstance(payload, dict) or payload.get("exp", 0) < int(time.time()):
        return None
    return payload