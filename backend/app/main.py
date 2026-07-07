"""
My Pivot バックエンド エントリーポイント

起動方法：
    cd backend
    uvicorn app.main:app --reload

起動後、http://localhost:8000/docs で
自動生成されたAPIドキュメント（Swagger UI）を確認できる。
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
from app.routers import pivots, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時にDBテーブルを作成
    create_db_and_tables()
    yield


app = FastAPI(title="My Pivot API", lifespan=lifespan)

# フロント（React）からのアクセスを許可する（CORS設定）
# 開発中は localhost の各ポートを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite のデフォルトポート
        "http://localhost:3000",  # Next.js のデフォルトポート
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(users.router)
app.include_router(pivots.router)


@app.get("/")
def root():
    return {"message": "My Pivot API is running", "docs": "/docs"}
