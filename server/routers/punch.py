"""打卡路由：单日打卡保存 / 删除。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server.auth import get_current_user, get_db
from server.models import Punch, User
from server.schemas import PunchIn

router = APIRouter(prefix="/api/punch", tags=["punch"])


@router.post("/{date}")
def save_punch(date: str, body: PunchIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not body.leave and (not body.in_time or not body.out_time):
        raise HTTPException(status_code=400, detail="请填写打卡时间，或勾选请假")
    db.query(Punch).filter(Punch.user_id == user.id, Punch.date == date).delete()
    db.add(
        Punch(
            user_id=user.id,
            date=date,
            in_time=body.in_time,
            out_time=body.out_time,
            leave=body.leave,
            note=body.note,
        )
    )
    db.commit()
    return {"ok": True}


@router.delete("/{date}")
def del_punch(date: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Punch).filter(Punch.user_id == user.id, Punch.date == date).delete()
    db.commit()
    return {"ok": True}
