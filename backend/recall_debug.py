"""
召喚(意味検索)の閾値調整用デバッグスクリプト。

使い方(backend で venv を activate した状態で):
    python recall_debug.py "大学院に行かないことにした"

全エントリとの類似度を高い順に表示する。
RECALL_MIN_SIMILARITY(既定0.5)の線をどこに引くかの判断材料にする。
"""
import sys

from sqlmodel import Session, select

from app import settings
from app.database import engine
from app.models import Entry
from app.services import embeddings


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "大学院に行かないことにした"
    print(f"query: {query}")
    print(f"model: {settings.RECALL_MODEL}")
    print(f"現在の閾値 RECALL_MIN_SIMILARITY = {settings.RECALL_MIN_SIMILARITY}\n")

    embeddings._load_model_blocking()  # 同期ロード(初回はDL待ちあり)
    if not embeddings.is_ready():
        print("モデルをロードできませんでした")
        return

    qvec = embeddings.embed_query_texts([query])[0]
    with Session(engine) as session:
        entries = list(session.exec(select(Entry)))
        embeddings.backfill_missing(session, entries)
        vectors = embeddings.load_vectors(session, [e.id for e in entries if e.id])
        scored = []
        for e in entries:
            vec = vectors.get(e.id)
            if vec:
                scored.append((embeddings.cosine(qvec, vec), e))
        scored.sort(key=lambda x: x[0], reverse=True)
        for s, e in scored[:15]:
            mark = "○" if s >= settings.RECALL_MIN_SIMILARITY else "✗"
            print(f"{mark} {s:.3f}  #{e.id} {e.title}  | {e.body[:30]}")


if __name__ == "__main__":
    main()
