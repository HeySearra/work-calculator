"""状态路由：整对象读写（兼容现有前端 save/load）。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server.auth import get_current_user, get_db
from server.dal import load_state, save_state
from server.models import User

router = APIRouter(prefix="/api", tags=["state"])


@router.get("/state")
def get_state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return load_state(db, user.id)


@router.put("/state")
def put_state(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    save_state(db, user.id, payload)
    return {"ok": True}
