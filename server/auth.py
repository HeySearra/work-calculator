"""JWT 认证 + 密码哈希 + 当前用户依赖。"""
import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from server.db import SessionLocal
from server.models import User

SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGO = "HS256"
try:
    ACCESS_MIN = int(os.environ.get("JWT_EXPIRE_MIN", "43200"))  # 默认 30 天
except ValueError:
    ACCESS_MIN = 43200

bearer = HTTPBearer(auto_error=False)


def hash_password(p: str) -> str:
    pw = p.encode("utf-8")
    if len(pw) > 72:  # bcrypt 硬上限
        raise ValueError("密码长度不能超过 72 字节")
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=ACCESS_MIN)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET, algorithm=ALGO)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        uid = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
