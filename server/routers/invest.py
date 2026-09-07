"""理财记录路由：按周/月/年保存单条。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server.auth import get_current_user, get_db
from server.models import InvestRecord, User
from server.schemas import InvestIn

router = APIRouter(prefix="/api/invest", tags=["invest"])


@router.post("/{kind}")
def save_invest(kind: str, body: InvestIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if kind not in ("week", "month", "year"):
        raise HTTPException(status_code=400, detail="kind must be week/month/year")
    db.query(InvestRecord).filter(
        InvestRecord.user_id == user.id, InvestRecord.kind == kind, InvestRecord.period == body.period
    ).delete()
    db.add(InvestRecord(user_id=user.id, period=body.period, kind=kind, value=body.value, meta=body.meta))
    db.commit()
    return {"ok": True}
