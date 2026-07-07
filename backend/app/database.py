"""
データベース接続設定

開発時は SQLite を使う（セットアップ不要・ファイル1つで完結）。
本番でクラウドに載せる場合は DATABASE_URL を差し替えるだけでよい。
"""
from sqlmodel import SQLModel, create_engine, Session

# SQLite ファイル。backend/ 直下に my_pivot.db が作られる
DATABASE_URL = "sqlite:///./my_pivot.db"

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
