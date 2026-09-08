# 打工人仪表盘 / Work Calculator

全栈考勤与资产看板：FastAPI + SQLite 后端，React + Vite + TypeScript 前端。

## 功能
- **今日**：实时计算当日已赚、距离目标还差多少、完成进度
- **历史**：打卡记录与在司时长
- **资产 / 养老 / FIRE / 投资**：多维度个人财务视图
- **设置**：作息、薪资、养老账户、FIRE、投资基准等可配置项

## 本地运行
- 后端：`cd server && pip install -r requirements.txt && uvicorn server.main:app --port 8000`
- 前端：`cd web && npm install && npm run build`（产物在 `web/dist`，由后端静态托管）

## 部署到服务器
- `bash deploy.sh` —— 仅 rsync 同步前后端并重启 systemd 服务
- `bash deploy.sh build` —— 先本地 `npm run build` 再同步
- 线上：`http://47.109.31.77`（FastAPI 跑在 80 端口，systemd 单元 `workcalc.service`）

## 自动存档到 GitHub
- `git-archive.sh` 会把本地改动提交并推送到 `origin/main`。
- 由 launchd LaunchAgent `com.workcalc.gitarchive` 每 2 分钟检查一次，有改动即提交+推送。
- 也可手动运行：`bash git-archive.sh`。
- 运行时数据（`server/data`）、构建产物（`web/dist`、`node_modules`）、密钥（`.env`）、
  WorkBuddy 内部（`.workbuddy`）均已在 `.gitignore` 中忽略，不会进入仓库。
