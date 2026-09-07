"""Pydantic 请求/响应模型。"""
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    token: str
    username: str


class PunchIn(BaseModel):
    in_time: str = ""
    out_time: str = ""
    leave: bool = False
    note: str = ""


class InvestIn(BaseModel):
    period: str
    kind: str  # week / month / year
    value: float | None = None
    meta: dict = {}
