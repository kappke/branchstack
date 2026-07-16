from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..cache import invalidate_token
from ..config import encrypt_token
from ..db import get_db
from ..github import GitHubClient, GitHubError
from ..models import GitToken, User
from ..schemas import TokenCreate, TokenOut

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


@router.get("", response_model=list[TokenOut])
def list_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(GitToken)
        .filter(GitToken.user_id == user.id)
        .order_by(GitToken.created_at.desc())
        .all()
    )


@router.post("", response_model=TokenOut)
def add_token(payload: TokenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    unique_name = f"{user.id}:{payload.name}"
    if db.query(GitToken).filter(GitToken.name == unique_name).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Token name already exists")
    # validate + enrich by hitting /user
    try:
        with GitHubClient(payload.token) as gh:
            me = gh.whoami()
    except GitHubError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"GitHub rejected token: {e.message}")
    label = me.get("login") or payload.name
    scopes = me.get("scopes") or ""
    encrypted = encrypt_token(payload.token)
    is_first = db.query(GitToken).filter(GitToken.user_id == user.id).count() == 0
    token = GitToken(
        user_id=user.id,
        name=unique_name,
        label=label,
        encrypted_token=encrypted,
        scopes=scopes,
        is_active=is_first,  # first token auto-active
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


@router.post("/{token_id}/activate", response_model=TokenOut)
def activate_token(token_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = db.get(GitToken, token_id)
    if not token or token.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    db.query(GitToken).filter(GitToken.user_id == user.id).update({GitToken.is_active: False})
    token.is_active = True
    db.commit()
    db.refresh(token)
    return token


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_token(token_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = db.get(GitToken, token_id)
    if not token or token.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    db.delete(token)
    db.commit()
    invalidate_token(token_id)