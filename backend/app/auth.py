from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import decrypt_token
from .db import get_db, get_db_session
from .github import GitHubClient
from .models import GitToken, User
from .security import verify_session_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = verify_session_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = db.get(User, payload.get("uid"))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin privileges required")
    return user


def get_active_client(
    token_id: Optional[int] = None,
) -> tuple[GitHubClient, GitToken]:
    """Return a GitHubClient built from the single configured app token.

    If ``token_id`` is given, that exact token is loaded (used when refreshing
    the status of an older deployment that was dispatched with a now-replaced
    token; 404s if the token no longer exists).
    """
    with get_db_session() as db:
        if token_id is not None:
            token = db.get(GitToken, token_id)
            if not token:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
        else:
            token = db.query(GitToken).order_by(GitToken.id.asc()).first()
            if not token:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "No GitHub token configured for the app")
        plaintext = decrypt_token(token.encrypted_token)
        client = GitHubClient(plaintext)
        return client, token