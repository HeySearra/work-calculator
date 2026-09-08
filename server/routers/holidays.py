"""节假日路由：代理 timor.tech 获取中国法定节假日及调休安排。"""
import json
import time
import urllib.request
from urllib.error import URLError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server.auth import get_current_user, get_db
from server.models import User

router = APIRouter(prefix="/api", tags=["holidays"])

# 简单内存缓存：按年份缓存 1 小时
_CACHE: dict[int, tuple[dict, float]] = {}
_CACHE_TTL = 3600


def _fetch_timor(year: int) -> dict:
    url = f"https://timor.tech/api/holiday/year/{year}/"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (URLError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"无法获取节假日数据: {e}")

    if data.get("code") != 0 or not isinstance(data.get("holiday"), dict):
        raise HTTPException(status_code=502, detail="节假日接口返回异常")

    holidays: list[str] = []
    workdays: list[str] = []  # 调休补班
    for item in data["holiday"].values():
        date = item.get("date")
        if not date:
            continue
        if item.get("holiday"):
            holidays.append(date)
        else:
            # holiday=false 且出现在接口里的日期都是调休补班
            workdays.append(date)

    return {"year": year, "holidays": sorted(holidays), "workdays": sorted(workdays)}


@router.get("/holidays/{year}")
def get_holidays(year: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cached = _CACHE.get(year)
    if cached and time.time() - cached[1] < _CACHE_TTL:
        return cached[0]

    result = _fetch_timor(year)
    _CACHE[year] = (result, time.time())
    return result
