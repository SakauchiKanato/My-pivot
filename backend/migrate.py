import os
from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine, select

# モデルを全てインポート
from app.models import (
    User, Book, SharedMembership, Tag, Entry, 
    EntryTagLink, EntryEmbedding, EntryAppend, BiasCheck
)

# 依存関係（親テーブルが先）の順に並べる
MODELS = [
    User,
    Book,
    SharedMembership,
    Tag,
    Entry,
    EntryTagLink,
    EntryEmbedding,
    EntryAppend,
    BiasCheck
]

def migrate():
    # 1. SQLiteの接続（読み込み元）
    sqlite_path = Path(__file__).resolve().parent / "my_pivot.db"
    if not sqlite_path.exists():
        print(f"Error: SQLiteデータベースが見つかりません: {sqlite_path}")
        return
    
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
    
    # 2. PostgreSQLの接続（書き込み先）
    pg_url = os.environ.get("DATABASE_URL")
    if not pg_url or pg_url.startswith("sqlite"):
        print("Error: DATABASE_URL に PostgreSQL の接続URLを設定してください。")
        print("例: export DATABASE_URL=postgresql://user:pass@host/dbname")
        return
        
    pg_engine = create_engine(pg_url)
    
    # 3. PostgreSQL側にテーブルを作成
    print("PostgreSQLにテーブルを作成中...")
    
    # GINインデックス(gin_trgm_ops)を使用するため、pg_trgm 拡張機能を有効化する
    from sqlalchemy import text
    with pg_engine.connect() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS pg_trgm;'))
        conn.commit()

    SQLModel.metadata.create_all(pg_engine)
    
    print("データ移行を開始します...")
    
    with Session(sqlite_engine) as sqlite_session:
        with Session(pg_engine) as pg_session:
            for model in MODELS:
                print(f"[{model.__name__}] 移行中...")
                rows = sqlite_session.exec(select(model)).all()
                if not rows:
                    print(f"  -> データがありません。スキップします。")
                    continue
                
                # 既にデータがある場合はスキップ (重複エラー防止)
                existing = pg_session.exec(select(model)).first()
                if existing:
                    print(f"  -> PostgreSQL側に既にデータが存在するためスキップします。")
                    continue
                    
                # データを変換して追加
                for row in rows:
                    new_row = model(**row.model_dump())
                    pg_session.add(new_row)
                
                pg_session.commit()
                print(f"  -> {len(rows)} 件のデータを移行しました。")
                
    print("✨ 全てのデータ移行が完了しました！")

if __name__ == "__main__":
    migrate()
