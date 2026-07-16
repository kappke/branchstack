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


def get_active_client(
    token_id: Optional[int] = None, user_id: Optional[int] = None
) -> tuple[GitHubClient, GitToken]:
    """Return a GitHubClient built from the active (or specified) stored token.

    If ``user_id`` is given the token lookup/ownership is constrained to that
    user, so callers cannot escalate to another user's tokens.
    """
    with get_db_session() as db:
        if token_id is not None:
            token = db.get(GitToken, token_id)
            if not token or (user_id is not None and token.user_id != user_id):
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
        else:
            q = db.query(GitToken).filter(GitToken.is_active.is_(True))
            if user_id is not None:
                q = q.filter(GitToken.user_id == user_id)
            token = q.first()
            if not token:
                if user_id is not None:
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST,
                        "No active GitHub token configured for this user",
                    )
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active GitHub token configured")
        plaintext = decrypt_token(token.encrypted_token)
        client = GitHubClient(plaintext)
        return client, token