#!/bin/bash
# git-archive.sh — 把本地代码改动提交到本地 git 并推送到 GitHub
#
# 设计变更（2026-09-08）：
#   - 默认 commit 后立即 push 到 origin main（用户要求：本地 commit 之后直接 push）
#   - commit message 不再用固定时间戳，改为根据实际改动文件生成；也可手动传入
#   - launchd 定时任务已禁用，脚本只在手动调用时运行
#
# 用法：
#   bash git-archive.sh                 # 自动生成 message（列出改动的文件）+ 推送
#   bash git-archive.sh "feat: 新增XXX"  # 使用自定义 message + 推送
#
# 注意：严格遵守 .gitignore，不会提交 node_modules / dist / 数据库等。
#       server/data、web/dist、node_modules、.env、.workbuddy 均被忽略。

set -u

PROJ="/Users/searra/WorkBuddy/纯文本"
GIT="/usr/bin/git"
LOCK="$PROJ/.git/archive.lockdir"
LOG="$PROJ/.git/archive.log"

# 防止并发运行（mkdir 锁，macOS 无 flock）
if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

cd "$PROJ" || exit 0

# 不是 git 仓库就退出
"$GIT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TS] run" >>"$LOG"

# 暂存（尊重 .gitignore）
"$GIT" add -A

# 无改动则直接结束
if "$GIT" diff --cached --quiet; then
  echo "[$TS] no changes" >>"$LOG"
  exit 0
fi

# ===== 根据实际改动生成 commit message =====
MSG="${1:-}"
if [ -z "$MSG" ]; then
  # 改动文件清单（已暂存）
  FILES=$("$GIT" diff --cached --name-only)
  CNT=$(echo "$FILES" | grep -c . || true)

  if [ "$CNT" -eq 1 ]; then
    MSG="更新 $FILES"
  else
    # 多个文件：取前 3 个文件名（仅 basename），其余用计数概括
    NAMES=$(echo "$FILES" | head -3 | xargs -n1 basename | paste -sd '、' -)
    if [ "$CNT" -gt 3 ]; then
      MSG="更新 $CNT 个文件（$NAMES 等）"
    else
      MSG="更新 $CNT 个文件（$NAMES）"
    fi
  fi
fi

"$GIT" commit -m "$MSG" >>"$LOG" 2>&1
echo "[$TS] committed: $MSG" >>"$LOG"
echo "$MSG"

# commit 后立即推送到 GitHub
"$GIT" push origin main >>"$LOG" 2>&1
if [ $? -eq 0 ]; then
  echo "[$TS] pushed -> origin/main" >>"$LOG"
else
  echo "[$TS] push FAILED (check network/remote)" >>"$LOG"
fi

exit 0
