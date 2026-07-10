"""
データベース接続設定(旧版から移植)
SQLite。DATABASE_URL 環境変数で差し替え可能。
"""
import os
from pathlib import Path

from sqlalchemy import event
from sqlmodel import SQLModel, create_engine, Session

_DB_PATH = Path(__file__).resolve().parent.parent / "my_pivot.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    # timeout: ロック競合時にすぐ落ちず最大15秒待つ(database is locked対策)
    connect_args={"check_same_thread": False, "timeout": 15} if DATABASE_URL.startswith("sqlite") else {},
)

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _record):
        """WALモード: 読み書きの同時実行に強くする(AI機能で書き込みが増えたため)。"""
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=15000")
        cur.close()


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
