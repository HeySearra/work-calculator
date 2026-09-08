"""FastAPI 入口：挂载路由、CORS、建表，并可选地托管前端构建产物。"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.db import init_db
from server.routers import auth, holidays, invest, io, punch, state, benchmarks

app = FastAPI(title="打工人仪表盘 API")

# 开发期前端在 Vite(5173) 跑，通过 proxy 访问 /api；生产可放开 origins 白名单
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(auth.router)
app.include_router(state.router)
app.include_router(punch.router)
app.include_router(invest.router)
app.include_router(io.router)
app.include_router(holidays.router)
app.include_router(benchmarks.router)


@app.get("/health")
def health():
    return {"ok": True}


# 生产：若 web/dist 存在则托管前端（SPA）。开发期可忽略。
_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "dist")
if os.path.isdir(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="static")
