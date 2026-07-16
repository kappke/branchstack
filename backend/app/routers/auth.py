from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, PasswordChangeRequest, UserOut
from ..security import create_session_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = create_session_token(user.id)
    return LoginResponse(token=token, user=UserOut.model_validate(user))


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    # Stateless token: nothing to revoke server-side; client must drop the token.
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/password")
def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if not payload.new_password or len(payload.new_password) < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must not be empty")
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    return {"ok": True}