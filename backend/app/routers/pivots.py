# pyrefly: ignore [missing-import]
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from datetime import datetime

from app.database import get_session
from app.models import Pivot, Tag, PivotTagLink, Layer, Flag
from app.services.tag_mapper import map_tag_to_category
from pydantic import BaseModel

router = APIRouter(prefix="/pivots", tags=["pivots"])


class TagOut(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True


class PivotOut(BaseModel):
    id: int
    title: str
    content: str
    layer: Layer
    flag: Optional[Flag]
    confidence: Optional[int]
    image_url: Optional[str]
    created_at: datetime
    tags: List[TagOut] = []

    class Config:
        from_attributes = True


class PivotCreate(BaseModel):
    title: str
    content: str
    layer: Layer = Layer.PIVOT
    confidence: Optional[int] = None
    image_url: Optional[str] = None
    tag_names: List[str] = []  # 例: ["#絶望", "#進路"]


class FlagUpdate(BaseModel):
    flag: Flag



def _get_or_create_tags(tag_names: List[str], session: Session) -> List[Tag]:
    """タグ名のリストを受け取り、DBに存在すれば取得・なければ作成して返す。"""
    tags: List[Tag] = []
    for name in tag_names:
        existing = session.exec(select(Tag).where(Tag.name == name)).first()
        if existing:
            tags.append(existing)
        else:
            category = map_tag_to_category(name)
            new_tag = Tag(name=name, category=category)
            session.add(new_tag)
            session.flush()  # IDを確定させる
            tags.append(new_tag)
    return tags


def _pivot_to_out(pivot: Pivot) -> PivotOut:
    """PivotモデルをPivotOutスキーマに変換する。"""
    return PivotOut(
        id=pivot.id,
        title=pivot.title,
        content=pivot.content,
        layer=pivot.layer,
        flag=pivot.flag,
        confidence=pivot.confidence,
        image_url=pivot.image_url,
        created_at=pivot.created_at,
        tags=[TagOut(id=t.id, name=t.name, category=t.category) for t in pivot.tags],
    )


@router.post("", response_model=PivotOut, status_code=201)
def create_pivot(body: PivotCreate, session: Session = Depends(get_session)):
    """五里霧中モードの記録を新規作成する。"""
    pivot = Pivot(
        title=body.title,
        content=body.content,
        layer=body.layer,
        confidence=body.confidence,
        image_url=body.image_url,
    )
    session.add(pivot)
    session.flush()  # IDを確定させる

    tags = _get_or_create_tags(body.tag_names, session)
    for tag in tags:
        link = PivotTagLink(pivot_id=pivot.id, tag_id=tag.id)
        session.add(link)

    session.commit()
    session.refresh(pivot)
    return _pivot_to_out(pivot)


@router.get("", response_model=List[PivotOut])
def list_pivots(
    # 3軸検索パラメータ
    q: Optional[str] = Query(default=None, description="タイトル・本文の全文検索（意味軸）"),
    tag: Optional[str] = Query(default=None, description="タグ名で絞り込み（タグ軸）"),
    from_date: Optional[datetime] = Query(default=None, description="作成日時の始点（いつ軸）"),
    to_date: Optional[datetime] = Query(default=None, description="作成日時の終点（いつ軸）"),
    layer: Optional[Layer] = Query(default=None, description="レイヤー絞り込み"),
    flag: Optional[Flag] = Query(default=None, description="SUCCESS / REGRET 絞り込み"),
    session: Session = Depends(get_session),
):
    """ピボット一覧を取得する（3軸検索対応）。"""
    statement = select(Pivot)

    # 意味軸：タイトル・本文の部分一致
    if q:
        statement = statement.where(
            (Pivot.title.contains(q)) | (Pivot.content.contains(q))
        )

    # いつ軸：作成日時の範囲
    if from_date:
        statement = statement.where(Pivot.created_at >= from_date)
    if to_date:
        statement = statement.where(Pivot.created_at <= to_date)

    # レイヤー絞り込み
    if layer:
        statement = statement.where(Pivot.layer == layer)

    # フラグ絞り込み
    if flag:
        statement = statement.where(Pivot.flag == flag)

    pivots = session.exec(statement.order_by(Pivot.created_at.desc())).all()

    # タグ軸：メモリ上でフィルタ（多対多のJOINは後で最適化可能）
    if tag:
        pivots = [p for p in pivots if any(t.name == tag for t in p.tags)]

    return [_pivot_to_out(p) for p in pivots]


@router.get("/{pivot_id}", response_model=PivotOut)
def get_pivot(pivot_id: int, session: Session = Depends(get_session)):
    """ピボット詳細を取得する（ノードクリック時）。"""
    pivot = session.get(Pivot, pivot_id)
    if not pivot:
        raise HTTPException(status_code=404, detail="Pivot not found")
    return _pivot_to_out(pivot)


@router.patch("/{pivot_id}/flag", response_model=PivotOut)
def update_flag(pivot_id: int, body: FlagUpdate, session: Session = Depends(get_session)):
    """成功 / 後悔フラグを後から付与・更新する。"""
    pivot = session.get(Pivot, pivot_id)
    if not pivot:
        raise HTTPException(status_code=404, detail="Pivot not found")
    pivot.flag = body.flag
    session.add(pivot)
    session.commit()
    session.refresh(pivot)
    return _pivot_to_out(pivot)


@router.delete("/{pivot_id}", status_code=204)
def delete_pivot(pivot_id: int, session: Session = Depends(get_session)):
    """ピボットを削除する。"""
    pivot = session.get(Pivot, pivot_id)
    if not pivot:
        raise HTTPException(status_code=404, detail="Pivot not found")

    # リンクテーブルの行を先に削除
    links = session.exec(select(PivotTagLink).where(PivotTagLink.pivot_id == pivot_id)).all()
    for link in links:
        session.delete(link)

    session.delete(pivot)
    session.commit()
