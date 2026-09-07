"""ORM 模型。所有业务表均带 user_id，实现多用户数据隔离。"""
from datetime import datetime

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, JSON, String, Text

from server.db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(String(32), default=lambda: datetime.utcnow().isoformat())


class KV(Base):
    """通用键值表：存 profile/payday/pension/fire/invest(配置)/accounts/trend/holidays/user 等小配置。"""
    __tablename__ = "kv"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)


class Punch(Base):
    """每日打卡，量最大，独立成表便于按年查询/统计。"""
    __tablename__ = "punches"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    date = Column(String(10), primary_key=True)  # YYYY-MM-DD
    in_time = Column(String(5), nullable=False, default="")
    out_time = Column(String(5), nullable=False, default="")
    leave = Column(Boolean, default=False)
    note = Column(Text, default="")


class InvestRecord(Base):
    """理财记录：周/月/年。"""
    __tablename__ = "invest_records"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    period = Column(String(16), primary_key=True)  # 2026-09 / 2026-W36 / 2025
    kind = Column(String(8), primary_key=True)     # week / month / year
    value = Column(Float, nullable=True)
    meta = Column(JSON, default=dict)
