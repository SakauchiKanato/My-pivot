"""
ピボット関連のAPI

エンドポイント（全て要ログイン）：
- POST   /api/pivots        新規作成（タグ整理も実行）
- GET    /api/pivots        一覧取得（タイムライン用・自分のものだけ）
- GET    /api/pivots/search 3軸検索（自分のものだけ）
- GET    /api/pivots/{id}   個別取得
- PATCH  /api/pivots/{id}   評価(flag)の更新
"""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.models import Pivot, Tag, Layer, Flag, User
from app.services.tag_mapper import map_tag_to_category
from app.auth import get_current_user
from app.services.llm_bias_checker import check_outcome_bias,BiasCheckResult

router = APIRouter(prefix="/api/pivots", tags=["pivots"])


# --- リクエスト/レスポンスの形 ---
class PivotCreate(BaseModel):
    title: str
    content: str
    layer: Layer = Layer.PIVOT
    confidence: Optional[int] = None
    tag_names: List[str] = []



class FlagUpdate(BaseModel):
    flag: Flag
    reason_judgment: Optional[str] = None
    ai_question: Optional[str] = None
    ai_chat_history: Optional[str] = None

class BiasCheckRequest(BaseModel):
    flag: Flag
    reason_judgment: str



def _serialize_pivot(p: Pivot) -> dict:
    """Pivot オブジェクトをレスポンス用の dict に変換する。tags を確実に含める。"""
    return {
        "id": p.id,
        "title": p.title,
        "content": p.content,
        "layer": p.layer,
        "flag": p.flag,
        "confidence": p.confidence,
        "created_at": p.created_at,
        "tags": [{"name": t.name, "category": t.category} for t in p.tags],
        "is_ai_intervened": p.is_ai_intervened,
        "ai_question": p.ai_question,
        "ai_chat_history": p.ai_chat_history,
    }


# --- 新規作成 ---
@router.post("")
def create_pivot(
    data: PivotCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    pivot = Pivot(
        title=data.title,
        content=data.content,
        layer=data.layer,
        confidence=data.confidence,
        user_id=current_user.id,
    )
    # 先にpivotをsessionに登録してからタグをひもづける
    # （順序を守らないとSQLAlchemyがタグ追加を無視する）
    session.add(pivot)

    # タグを整理してひもづける
    for name in data.tag_names:
        category = map_tag_to_category(name)
        # 既存タグがあれば再利用、なければ作成
        existing = session.exec(select(Tag).where(Tag.name == name)).first()
        if existing:
            pivot.tags.append(existing)
        else:
            pivot.tags.append(Tag(name=name, category=category))

    session.commit()
    session.refresh(pivot)
    return _serialize_pivot(pivot)


# --- 一覧取得（自分のピボットのみ・新しい順） ---
@router.get("")
def list_pivots(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    pivots = session.exec(
        select(Pivot)
        .where(Pivot.user_id == current_user.id)
        .order_by(Pivot.created_at)
    ).all()
    # tags は lazy load なので明示的にシリアライズして返す
    return [_serialize_pivot(p) for p in pivots]


# --- 3軸検索（自分のものだけ・いつ・意味・タグ） ---
@router.get("/search")
def search_pivots(
    keyword: Optional[str] = Query(None, description="意味（タイトル）検索"),
    category: Optional[str] = Query(None, description="種類（タグカテゴリ）"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Pivot).where(Pivot.user_id == current_user.id)
    if keyword:
        stmt = stmt.where(Pivot.title.contains(keyword))
    pivots = session.exec(stmt).all()

    # カテゴリでの絞り込み（タグ経由）
    if category:
        pivots = [
            p for p in pivots
            if any(t.category == category for t in p.tags)
        ]
    return [_serialize_pivot(p) for p in pivots]


# --- 個別取得 ---
@router.get("/{pivot_id}")
def get_pivot(
    pivot_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    pivot = session.get(Pivot, pivot_id)
    if not pivot:
        raise HTTPException(status_code=404, detail="Pivot not found")
    # 他のユーザーのピボットは見えない
    if pivot.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="アクセスが許可されていません")
    return _serialize_pivot(pivot)


# --- 評価の更新（成功/後悔フラグと、理由の保存） ---
@router.patch("/{pivot_id}")
def update_flag(
    pivot_id: int,
    data: FlagUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    pivot = session.get(Pivot, pivot_id)
    if not pivot or pivot.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Pivot not found")
    
    pivot.flag = data.flag
    # 理由も保存する
    if data.reason_judgment is not None:
        pivot.reason_judgment = data.reason_judgment

    # AIの問いかけを押し切った場合
    if data.ai_question is not None:
        pivot.ai_question = data.ai_question
        pivot.is_ai_intervened = True

    # AIとの葛藤履歴を保存
    if data.ai_chat_history is not None:
        pivot.ai_chat_history = data.ai_chat_history

    session.add(pivot)
    session.commit()
    session.refresh(pivot)
    return _serialize_pivot(pivot)


# --- AIによるアウトカムバイアス判定 ---
@router.post("/{pivot_id}/check_bias", response_model=BiasCheckResult)
def check_bias(
    pivot_id: int,
    data: BiasCheckRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    pivot = session.get(Pivot, pivot_id)
    if not pivot or pivot.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Pivot not found")
    
    # 決定時の情報と、今回の入力情報をAIに渡す
    result = check_outcome_bias(
        title=pivot.title,
        content=pivot.content,
        confidence=pivot.confidence or 3,
        flag=data.flag.value,
        reason_judgment=data.reason_judgment
    )
    return result
