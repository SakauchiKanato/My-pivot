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
    repair_postgres_sequences()


def repair_postgres_sequences():
    """
    Postgresの自動採番のズレを起動時に自動修復する(冪等)。

    既存データをID込みで移行するとシーケンスが進まず、新規INSERTが
    "duplicate key value violates unique constraint" で落ちる。
    起動のたびに各テーブルの採番を MAX(id)+1 へ合わせて防ぐ。
    """
    if not DATABASE_URL.startswith("postgresql"):
        return
    from sqlalchemy import text

    tables = ["user", "book", "entry", "tag", "entryappend", "biascheck"]
    try:
        with engine.begin() as conn:
            for t in tables:
                quoted = f'"{t}"'
                seq = conn.execute(
                    text("SELECT pg_get_serial_sequence(:tbl, 'id')"), {"tbl": quoted}
                ).scalar()
                if not seq:
                    continue
                max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {quoted}")).scalar()
                conn.execute(text("SELECT setval(:seq, :val, false)"), {"seq": seq, "val": max_id + 1})
        print("[db] Postgresの採番シーケンスを確認・修復しました")
    except Exception as e:
        # 修復失敗でも起動は止めない
        print(f"[db] シーケンス修復をスキップ: {e}")


def get_session():
    with Session(engine) as session:
        yield session
