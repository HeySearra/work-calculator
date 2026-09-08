#!/bin/bash
# git-archive.sh — 自动把本地代码改动提交并推送到 GitHub（个人存档）
#
# 设计：
#   1) git add -A（严格遵守 .gitignore，不会提交 node_modules / dist / 数据库等）
#   2) 若有改动 -> 提交，message 带时间戳
#   3) 若本地领先远端 -> 推送（先确认网络可达，离线则跳过，下次再推）
# 由 launchd 定时调用，也可手动运行：bash /Users/searra/WorkBuddy/纯文本/git-archive.sh
#
# 注意：仅提交“已跟踪或新出现”的源码文件；运行时数据（server/data）、构建产物
# （web/dist、node_modules）、密钥（.env）、WorkBuddy 内部（.workbuddy）均被忽略。

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

# 有改动则提交
if ! "$GIT" diff --cached --quiet; then
  "$GIT" commit -m "auto-archive: 本地改动 $TS" >>"$LOG" 2>&1
  echo "[$TS] committed" >>"$LOG"
fi

# 若本地领先远端，则推送
AHEAD=$("$GIT" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" -gt 0 ]; then
  # 先确认网络可达，离线则跳过，等下次
  if "$GIT" ls-remote --heads origin >/dev/null 2>&1; then
    if "$GIT" push origin main >>"$LOG" 2>&1; then
      echo "[$TS] pushed ($AHEAD commit(s))" >>"$LOG"
    else
      echo "[$TS] push failed (see log)" >>"$LOG"
    fi
  else
    echo "[$TS] offline, skip push (will retry later)" >>"$LOG"
  fi
fi

exit 0
