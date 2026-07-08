"""
データベース接続設定(旧版から移植)
SQLite。DATABASE_URL 環境変数で差し替え可能。
"""
import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

_DB_PATH = Path(__file__).resolve().parent.parent / "my_pivot.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
