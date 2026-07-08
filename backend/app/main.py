"""
My Pivot バックエンド エントリーポイント(v3 UI 対応版)

起動:
    cd backend
    uvicorn app.main:app --reload

http://localhost:8000/docs で Swagger UI。
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
from app.routers import auth, library, publish, insights


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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


@app.get("/")
def root():
    return {"message": "My Pivot API v4 is running", "docs": "/docs"}
