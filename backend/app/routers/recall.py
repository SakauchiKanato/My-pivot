"""
召喚API(意味検索版・AI候補A)

POST /api/recall {text} → 可視なエントリから意味的に似た記録を返す

設計制約の実装箇所:
- T1(決定時)にAIは答えを出さない。ここは「検索」であり生成をしない
- 返すのは entryId とスコアだけ。本文はフロントが手元の生データを表示する
  (AIが加工した文章が画面に出る余地を構造的に無くしている)
- available=false のときフロントは従来の bigram 一致にフォールバック
  → モデル未ロード・未インストール・障害時もデモが止まらない
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app import settings
from app.database import get_session
from app.models import User
from app.auth.deps import get_current_user
from app.routers.library import visible_books
from app.services import embeddings

router = APIRouter(prefix="/api", tags=["recall"])


class RecallRequest(BaseModel):
    text: str
    limit: int = 3


class RecallHit(BaseModel):
    entryId: int
    score: float


class RecallResponse(BaseModel):
    available: bool
    results: list[RecallHit]
    minSimilarity: float


@router.post("/recall", response_model=RecallResponse)
def recall(
    data: RecallRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    unavailable = RecallResponse(
        available=False, results=[], minSimilarity=settings.RECALL_MIN_SIMILARITY
    )
    if not settings.RECALL_SEMANTIC_ENABLED:
        return unavailable

    text = data.text.strip()
    if len(text) < 4:
        return RecallResponse(available=True, results=[], minSimilarity=settings.RECALL_MIN_SIMILARITY)

    qvecs = embeddings.embed_query_texts([text])
    if qvecs is None:  # モデル未ロード(ロードは裏で開始済み)
        return unavailable
    qvec = qvecs[0]

    # 可視性は library と同じルールを使う(mine他人分などは検索対象外)
    books = visible_books(session, user)
    entries = [e for b in books for e in b.entries]
    if not entries:
        return RecallResponse(available=True, results=[], minSimilarity=settings.RECALL_MIN_SIMILARITY)

    # 未計算分をその場で補完(通常は起動時バックフィル済みで0件)
    embeddings.backfill_missing(session, entries)
    vectors = embeddings.load_vectors(session, [e.id for e in entries if e.id])

    scored = []
    for e in entries:
        vec = vectors.get(e.id)
        if vec is None:
            continue
        s = embeddings.cosine(qvec, vec)
        if s >= settings.RECALL_MIN_SIMILARITY:
            scored.append(RecallHit(entryId=e.id, score=round(s, 3)))
    scored.sort(key=lambda h: h.score, reverse=True)

    limit = max(1, min(10, data.limit))
    return RecallResponse(
        available=True, results=scored[:limit], minSimilarity=settings.RECALL_MIN_SIMILARITY
    )
