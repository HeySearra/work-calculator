"""导入 / 导出路由。"""
import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from server.auth import get_current_user, get_db
from server.dal import load_state, save_state
from server.models import User

router = APIRouter(prefix="/api", tags=["io"])


@router.get("/export")
def export(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = load_state(db, user.id)
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=work-calculator-export.json"},
    )


@router.post("/import")
def import_state(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    save_state(db, user.id, payload)
    return {"ok": True}
