# pyrefly: ignore [missing-import]
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import create_db_and_tables
from app.routers import pivots

# アプリ起動時にDBとテーブルを自動作成
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(
    title="My Pivot API",
    description="迷った数だけ、私は進んだ。過去の選択・迷いを記録するアプリのバックエンドAPI。",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS設定（フロントエンド http://localhost:5173 からのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(pivots.router)
