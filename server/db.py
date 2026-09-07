"""数据库引擎与会话（SQLAlchemy 2.0）。默认 SQLite，改 DATABASE_URL 可平滑切 PostgreSQL。"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

_raw = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'app.db')}")
# 支持相对路径形式 sqlite:///./data/app.db
if _raw.startswith("sqlite:///") and not _raw.startswith("sqlite:///:memory:"):
    _p = _raw[len("sqlite:///"):]
    if not os.path.isabs(_p):
        _p = os.path.join(BASE_DIR, _p)
    os.makedirs(os.path.dirname(_p) or DATA_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{_p}"
else:
    DATABASE_URL = _raw

_is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def init_db():
    # 导入模型以确保表被注册
    from server import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
