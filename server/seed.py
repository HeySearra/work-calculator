"""一次性迁移脚本：用现有 localStorage 导出 JSON 初始化一个账号并写入数据库。

用法（在项目根目录）：
  python -m server.seed <用户名> <密码> [export.json]
"""
import json
import os
import sys

from server.auth import hash_password
from server.dal import save_state
from server.db import SessionLocal, init_db
from server.models import User


def main():
    if len(sys.argv) < 3:
        print("usage: python -m server.seed <用户名> <密码> [export.json]")
        return
    username, password = sys.argv[1], sys.argv[2]
    path = sys.argv[3] if len(sys.argv) > 3 else None

    init_db()
    db = SessionLocal()
    u = db.query(User).filter(User.username == username).first()
    if not u:
        u = User(username=username, password_hash=hash_password(password))
        db.add(u)
        db.commit()
        db.refresh(u)
        print(f"created user '{username}' (id={u.id})")
    else:
        print(f"user '{username}' already exists (id={u.id})")

    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            state = json.load(f)
        save_state(db, u.id, state)
        print(f"imported state from {path}")
    db.close()


if __name__ == "__main__":
    main()
