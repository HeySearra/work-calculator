#!/bin/bash
# 打工人仪表盘 —— 一键部署/更新到公网服务器 47.109.31.77
# 用法：
#   ./deploy.sh          仅同步已构建的产物 + 后端代码，并重启服务
#   ./deploy.sh build    先在本地重新 vite build，再同步（前端有改动时用）
set -e

HOST=root@47.109.31.77
KEY=~/.ssh/id_ed25519
LOCAL=/Users/searra/WorkBuddy/纯文本
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
REMOTE=/opt/workcalc

# 1) 可选：本地重新构建前端
if [ "$1" = "build" ]; then
  echo "==> vite build ..."
  ( cd "$LOCAL/web" && npm run build )
fi

# 2) 同步后端与前端产物（--delete 保证远端与原目录一致；不会碰到 venv/data）
echo "==> rsync server/ ..."
rsync -az --delete -e "ssh $SSH_OPTS -i $KEY" "$LOCAL/server/" $HOST:$REMOTE/server/
echo "==> rsync web/dist/ ..."
rsync -az --delete -e "ssh $SSH_OPTS -i $KEY" "$LOCAL/web/dist/" $HOST:$REMOTE/web/dist/

# 3) 重启服务并自检
echo "==> restart workcalc ..."
ssh $SSH_OPTS -i $KEY $HOST "systemctl restart workcalc && sleep 1 && curl -s http://127.0.0.1/health"

echo
echo "部署完成 -> http://47.109.31.77"
