"""
My Pivot バックエンド エントリーポイント(v3 UI 対応版)

起動:
    cd backend
    uvicorn app.main:app --reload

http://localhost:8000/docs で Swagger UI。
"""
import threading
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app import settings
from app.database import create_db_and_tables
from app.routers import auth, library, publish, insights, recall, bias
from app.services import embeddings


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    if settings.RECALL_SEMANTIC_ENABLED:
        # 起動をブロックしない。ロード完了までは /api/recall が
        # available=false を返し、フロントは bigram にフォールバックする
        threading.Thread(target=embeddings.warmup_and_backfill, daemon=True).start()
    yield


app = FastAPI(title="My Pivot API v4", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(library.router)
app.include_router(publish.router)
app.include_router(insights.router)
app.include_router(recall.router)
app.include_router(bias.router)


# フロントエンドの静的ファイル配信
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

@app.get("/")
def root():
    if os.path.isdir(dist_dir):
        return FileResponse(os.path.join(dist_dir, "index.html"), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"message": "My Pivot API v4 is running", "docs": "/docs", "dist_dir": dist_dir, "cwd": os.getcwd(), "file": __file__, "exists": os.path.isdir(dist_dir), "parent_contents": os.listdir(os.path.join(dist_dir, "..")) if os.path.isdir(os.path.join(dist_dir, "..")) else "not found"}

if os.path.isdir(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})