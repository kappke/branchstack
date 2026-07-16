from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserOut
from ..security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "username and password are required")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    user = User(username=username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user