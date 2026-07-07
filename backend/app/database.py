"""
データベース接続設定

開発時は SQLite を使う（セットアップ不要・ファイル1つで完結）。
本番でクラウドに載せる場合は DATABASE_URL を差し替えるだけでよい。
"""
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

# このファイル (database.py) の場所を基準に backend/my_pivot.db を固定
# → どのディレクトリから uvicorn を起動してもパスがズレない
_DB_PATH = Path(__file__).resolve().parent.parent / "my_pivot.db"
DATABASE_URL = f"sqlite:///{_DB_PATH}"

# check_same_thread=False は SQLite を FastAPI で使うための定番設定
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def create_db_and_tables():
    """アプリ起動時にテーブルを作成する。"""
    SQLModel.metadata.create_all(engine)


def get_session():
    """APIごとにDBセッションを渡すための依存関数。"""
    with Session(engine) as session:
        yield session
