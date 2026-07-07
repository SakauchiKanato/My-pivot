# pyrefly: ignore [missing-import]
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///database.db"

engine = create_engine(DATABASE_URL)

def create_db_and_tables():
    """DBとテーブルを作成する（ファイルがなければ新規作成）"""
    SQLModel.metadata.create_all(engine)

def get_session() -> Session:
    """セッションの使い捨てコンテキストマネージャ"""
    with Session(engine) as session:
        yield session
