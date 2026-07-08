"""
公開API(個人の記録 → 共同/先達の書架へ「出版」)

設計原則(B-2 提案準拠、フラグで可変):
- 執筆フォームからは公開できない。公開は年表からの事後行為
- 原本は動かさない。公開は「コピーの作成」(source_entry_id で出自保持)
- B-3: PUBLISH_EDIT_MODE = "delete_only" の場合、公開コピーの本文は
  原本の行の部分集合でなければならない(加筆をサーバー側で拒否)
- B-4: PUBLISH_TO_SENPAI = False の間、先達棚への出版は 403

エンドポイント:
- POST /api/entries/{id}/publish
    { targetBookId?: int, newBookTitle?: str, passcode?: str (新しい共同の本を作る場合に必須),
      targetShelf: "shared"|"senpai", body?: str (編集後本文。省略時は原本のまま) }
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app import settings
from app.database import get_session
from app.models import Book, Entry, Shelf, Outcome, User, Tag
from app.auth.deps import get_current_user
from app.routers.library import serialize_entry, PALETTE, claim_shared_passcode, is_shared_member

router = APIRouter(prefix="/api", tags=["publish"])


class PublishRequest(BaseModel):
    targetShelf: Shelf = Shelf.SHARED
    targetBookId: Optional[int] = None
    newBookTitle: Optional[str] = None
    passcode: Optional[str] = None  # targetShelf=shared かつ新規作成のとき必須
    body: Optional[str] = None  # 編集後本文(delete_onlyなら行削除のみ)


def _is_line_subset(edited: str, original: str) -> bool:
    """edited が original の行順序を保った部分列か(行単位の削除のみ許可)。"""
    orig_lines = [l.strip() for l in original.splitlines()]
    idx = 0
    for line in edited.splitlines():
        line = line.strip()
        if not line:
            continue
        found = False
        while idx < len(orig_lines):
            if orig_lines[idx] == line:
                found = True
                idx += 1
                break
            idx += 1
        if not found:
            return False
    return True


@router.post("/entries/{entry_id}/publish")
def publish_entry(
    entry_id: int,
    data: PublishRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not settings.PUBLISH_ENABLED:
        raise HTTPException(403, "公開機能は現在無効です(D-1 凍結中)")

    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    if entry.author_id != user.id:
        raise HTTPException(403, "自分の記録のみ公開できます")
    if entry.source_entry_id is not None:
        raise HTTPException(400, "公開コピーを再公開することはできません")
    if settings.PUBLISH_REQUIRE_RESOLVED and entry.outcome == Outcome.PENDING:
        raise HTTPException(400, "結果が出た記録のみ公開できます(書き終わった記録が対象)")

    # 出版先の検証
    if data.targetShelf == Shelf.MINE:
        raise HTTPException(400, "公開先は shared または senpai です")
    if data.targetShelf == Shelf.SENPAI and not settings.PUBLISH_TO_SENPAI:
        raise HTTPException(403, "先達の書架への出版は未解禁です(B-4 未決)")

    # 本文の検証(B-3)
    body = (data.body if data.body is not None else entry.body).strip()
    if not body:
        raise HTTPException(400, "本文が空の公開はできません")
    if settings.PUBLISH_EDIT_MODE == "delete_only":
        if not _is_line_subset(body, entry.body):
            raise HTTPException(
                400,
                "公開時の編集は行の削除のみ許可されています(加筆・書き換えは不可)",
            )

    # 出版先の本を決定
    new_shared_passcode: Optional[str] = None
    if data.targetBookId is not None:
        book = session.get(Book, data.targetBookId)
        if not book or book.shelf != data.targetShelf:
            raise HTTPException(404, "出版先の本が見つかりません")
        if book.shelf == Shelf.SHARED and not is_shared_member(session, book, user):
            raise HTTPException(403, "参加していない共同の書架には出版できません")
    else:
        title = (data.newBookTitle or "").strip()
        if not title:
            raise HTTPException(400, "出版先の本を選ぶか、新しい本の名前を指定してください")
        new_shared_passcode = claim_shared_passcode(session, data.passcode) if data.targetShelf == Shelf.SHARED else None
        count = len(session.exec(select(Book)).all())
        book = Book(
            shelf=data.targetShelf,
            title=title[:12],
            fill=PALETTE[count % len(PALETTE)],
            owner_id=user.id,
            passcode=new_shared_passcode,
        )
        session.add(book)
        session.flush()

    copy = Entry(
        book_id=book.id,
        author_id=user.id,
        date=entry.date,
        title=entry.title,
        body=body,
        confidence=entry.confidence,
        outcome=entry.outcome,
        judgment=entry.judgment,
        reason_outcome=entry.reason_outcome,
        reason_judgment=entry.reason_judgment,
        resolve_date=entry.resolve_date,
        resolved_on=entry.resolved_on,
        source_entry_id=entry.id,
    )
    session.add(copy)
    # タグは共有
    for t in entry.tags:
        copy.tags.append(t)
    session.commit()
    session.refresh(copy)
    return {"published": serialize_entry(copy), "bookId": book.id, "passcode": new_shared_passcode}
