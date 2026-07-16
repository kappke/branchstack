import os
import base64
import json
import secrets
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/branchstack.db"
    github_api: str = "https://api.github.com"
    secret_key: str = "change-me-please"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    class Config:
        env_file = ".env"
        env_prefix = "BRANCHSTACK_"


settings = Settings()


def _derive_key() -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"branchstack-static-salt",
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.secret_key.encode()))
    return key


_fernet = Fernet(_derive_key())


def encrypt_token(token: str) -> str:
    return _fernet.encrypt(token.encode()).decode()


def decrypt_token(cipher: str) -> str:
    return _fernet.decrypt(cipher.encode()).decode()


def ensure_data_dir() -> None:
    Path("./data").mkdir(parents=True, exist_ok=True)