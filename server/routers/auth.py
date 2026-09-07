"""认证路由：注册 / 登录 / 当前用户。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server.auth import create_token, get_current_user, get_db, hash_password, verify_password
from server.models import User
from server.schemas import Token, UserCreate, UserLogin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(body: UserCreate, db: Session = Depends(get_db)):
    try:
        if db.query(User).filter(User.username == body.username).first():
            return Token(token="", username="")  # 前端据此判断失败（简化）
        u = User(username=body.username, password_hash=hash_password(body.password))
        db.add(u)
        db.commit()
        db.refresh(u)
        return Token(token=create_token(u.id), username=u.username)
    except Exception:
        db.rollback()
        return Token(token="", username="")


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    try:
        u = db.query(User).filter(User.username == body.username).first()
        if not u or not verify_password(body.password, u.password_hash):
            return Token(token="", username="")
        return Token(token=create_token(u.id), username=u.username)
    except Exception:
        return Token(token="", username="")


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"username": user.username, "id": user.id}
