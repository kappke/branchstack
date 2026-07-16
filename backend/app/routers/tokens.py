from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..cache import clear_all
from ..config import encrypt_token
from ..db import get_db
from ..github import GitHubClient, GitHubError
from ..models import GitToken, User
from ..schemas import TokenCreate, TokenOut

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


def _single(db: Session) -> GitToken | None:
    return db.query(GitToken).order_by(GitToken.id.asc()).first()


@router.get("", response_model=TokenOut | None)
def list_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _single(db)


@router.post("", response_model=TokenOut)
def set_token(payload: TokenCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not payload.token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "token is required")
    try:
        with GitHubClient(payload.token) as gh:
            me = gh.whoami()
    except GitHubError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"GitHub rejected token: {e.message}")
    label = me.get("login") or payload.name
    scopes = me.get("scopes") or ""
    organization = (payload.organization or "").strip() or None
    encrypted = encrypt_token(payload.token)

    existing = _single(db)
    if existing:
        existing.name = payload.name
        existing.label = label
        existing.organization = organization
        existing.encrypted_token = encrypted
        existing.scopes = scopes
        token = existing
    else:
        token = GitToken(
            name=payload.name,
            label=label,
            organization=organization,
            encrypted_token=encrypted,
            scopes=scopes,
        )
        db.add(token)
    db.commit()
    db.refresh(token)
    clear_all()
    return token


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_token(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    token = _single(db)
    if token:
        db.delete(token)
        db.commit()
        clear_all()