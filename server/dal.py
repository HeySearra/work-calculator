"""数据访问层：按 user_id 读写整份状态（S 对象）。

状态结构（与原前端 S 对齐）：
- KV 表：user / profile / payday / pension / fire / invest(配置) / accounts / trend / holidays
- punches 表：{ 'YYYY-MM-DD': {in,out,leave,note} }
- invest_records 表：weekly[] / monthly[{y,r}] / yearly{ 'YYYY': {cum} }
"""
import json

from sqlalchemy.orm import Session

from server.models import InvestRecord, KV, Punch

KV_KEYS = ["user", "profile", "payday", "pension", "fire", "invest", "accounts", "trend", "holidays"]


def _kv_get(db: Session, uid: int, key: str):
    row = db.get(KV, (uid, key))
    return json.loads(row.value) if row else None


def _kv_set(db: Session, uid: int, key: str, val) -> None:
    row = db.get(KV, (uid, key))
    payload = json.dumps(val, ensure_ascii=False)
    if row:
        row.value = payload
    else:
        db.add(KV(user_id=uid, key=key, value=payload))


def load_state(db: Session, uid: int) -> dict:
    state: dict = {}
    for k in KV_KEYS:
        v = _kv_get(db, uid, k)
        if v is not None:
            state[k] = v

    punches = {}
    for p in db.query(Punch).filter(Punch.user_id == uid).all():
        punches[p.date] = {
            "in": p.in_time,
            "out": p.out_time,
            "leave": 1 if p.leave else 0,
            "note": p.note or "",
        }
    state["punches"] = punches

    weekly, monthly, yearly = [], [], {}
    for r in db.query(InvestRecord).filter(InvestRecord.user_id == uid).all():
        if r.kind == "week":
            weekly.append({"period": r.period, "value": r.value, "meta": r.meta})
        elif r.kind == "month":
            monthly.append({"y": r.period, "r": r.value})
        elif r.kind == "year":
            yearly[r.period] = {"cum": r.value}
    state["weekly"] = weekly
    state["monthly"] = monthly
    state["yearly"] = yearly
    return state


def save_state(db: Session, uid: int, state: dict) -> None:
    for k in KV_KEYS:
        if k in state:
            _kv_set(db, uid, k, state[k])

    db.query(Punch).filter(Punch.user_id == uid).delete()
    for date, rec in (state.get("punches") or {}).items():
        db.add(
            Punch(
                user_id=uid,
                date=date,
                in_time=rec.get("in", ""),
                out_time=rec.get("out", ""),
                leave=bool(rec.get("leave")),
                note=rec.get("note", ""),
            )
        )

    db.query(InvestRecord).filter(InvestRecord.user_id == uid).delete()
    for w in state.get("weekly") or []:
        db.add(InvestRecord(user_id=uid, period=w.get("period", ""), kind="week", value=w.get("value"), meta=w.get("meta") or {}))
    for m in state.get("monthly") or []:
        db.add(InvestRecord(user_id=uid, period=m.get("y", ""), kind="month", value=m.get("r"), meta={}))
    for yk, yv in (state.get("yearly") or {}).items():
        val = yv.get("cum") if isinstance(yv, dict) else yv
        db.add(InvestRecord(user_id=uid, period=yk, kind="year", value=val, meta={}))

    db.commit()
