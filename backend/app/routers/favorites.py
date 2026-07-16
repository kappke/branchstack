from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import FavoriteRepo, User
from ..schemas import FavoriteRepoCreate, FavoriteRepoOut

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteRepoOut])
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(FavoriteRepo)
        .filter(FavoriteRepo.user_id == user.id)
        .order_by(FavoriteRepo.repo_full_name.asc())
        .all()
    )


@router.post("", response_model=FavoriteRepoOut, status_code=status.HTTP_201_CREATED)
def add_favorite(payload: FavoriteRepoCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = payload.repo_full_name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "repo_full_name is required")
    existing = (
        db.query(FavoriteRepo)
        .filter(FavoriteRepo.user_id == user.id, FavoriteRepo.repo_full_name == name)
        .first()
    )
    if existing:
        return existing
    fav = FavoriteRepo(user_id=user.id, repo_full_name=name)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/{repo_full_name:path}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(repo_full_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = (
        db.query(FavoriteRepo)
        .filter(FavoriteRepo.user_id == user.id, FavoriteRepo.repo_full_name == repo_full_name)
        .first()
    )
    if fav:
        db.delete(fav)
        db.commit()