"""
書庫API(本と記録)

可視性ルール:
- mine   : owner本人のみ
- shared : 本ごとに合言葉を1つ設定。作った本人(owner)と、その合言葉で
           参加(join)したユーザーだけが見える。新規登録直後は何も見えない
- senpai : 全員・読み専用

エンドポイント:
- GET  /api/library                 可視な全本+全記録(起動時1リクエスト)
- POST /api/books                   本を作る(mine/shared)。shared は合言葉必須
- POST /api/shared/join             合言葉で既存の共同の書架に参加する
- POST /api/books/{id}/entries      記録を綴じる
- POST /api/entries/{id}/resolve    結果を綴じる(outcome+judgment+理由)
- POST /api/entries/{id}/postpone   「まだ分からない」→ 1ヶ月延期
- POST /api/entries/{id}/appends    追記
- DELETE /api/entries/{id}          FIX_WINDOW内のみ(修正のための取り下げ)
"""
from datetime import datetime, date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app import settings
from app.database import get_session
from app.models import (
    Book, Entry, EntryAppend, Tag, Shelf, Outcome, Judgment, User, SharedMembership,
)
from app.services.tag_mapper import map_tag_to_category
from app.services import embeddings
from app.auth.deps import get_current_user

router = APIRouter(prefix="/api", tags=["library"])


# ---------- シリアライズ ----------
def serialize_entry(e: Entry) -> dict:
    now = datetime.now()
    fixable = (now - e.saved_at).total_seconds() < settings.FIX_WINDOW_SECONDS
    return {
        "id": e.id,
        "bookId": e.book_id,
        "authorId": e.author_id,
        "date": e.date,
        "title": e.title,
        "body": e.body,
        "tags": [t.name for t in e.tags],
        "confidence": e.confidence,
        "outcome": e.outcome,
        "judgment": e.judgment,
        "reasonOutcome": e.reason_outcome,
        "reasonJudgment": e.reason_judgment,
        "resolveDate": e.resolve_date,
        "resolvedOn": e.resolved_on,
        "sourceEntryId": e.source_entry_id,
        "fixable": fixable,
        "appends": [
            {"id": a.id, "date": a.date, "text": a.text}
            for a in sorted(e.appends, key=lambda a: (a.date, a.id or 0))
        ],
    }


def serialize_book(b: Book, entries: List[Entry], *, viewer_id: Optional[int] = None, reveal_passcode: bool = False) -> dict:
    return {
        "id": b.id,
        "shelf": b.shelf,
        "title": b.title,
        "fill": b.fill,
        "height": b.height,
        "ownerId": b.owner_id,
        # 合言葉は原則出さない。作成/参加した直後の応答でだけ本人に見せる
        "passcode": b.passcode if (reveal_passcode and b.owner_id == viewer_id) else None,
        "entries": [serialize_entry(e) for e in sorted(entries, key=lambda e: (e.date, e.id or 0))],
    }


def is_shared_member(session: Session, book: Book, user: User) -> bool:
    if book.owner_id == user.id:
        return True
    return session.get(SharedMembership, (book.id, user.id)) is not None


def visible_books(session: Session, user: User) -> List[Book]:
    books = session.exec(select(Book)).all()
    member_book_ids = {
        m.book_id for m in session.exec(
            select(SharedMembership).where(SharedMembership.user_id == user.id)
        )
    }
    return [
        b for b in books
        if (b.shelf != Shelf.MINE or b.owner_id == user.id)
        and (b.shelf != Shelf.SHARED or b.owner_id == user.id or b.id in member_book_ids)
    ]


def get_book_or_404(session: Session, book_id: int) -> Book:
    book = session.get(Book, book_id)
    if not book:
        raise HTTPException(404, "本が見つかりません")
    return book


def assert_writable(session: Session, book: Book, user: User):
    if book.shelf == Shelf.SENPAI:
        raise HTTPException(403, "先達の書架は読み専用です")
    if book.shelf == Shelf.MINE and book.owner_id != user.id:
        raise HTTPException(403, "この本には書き込めません")
    if book.shelf == Shelf.SHARED and not is_shared_member(session, book, user):
        raise HTTPException(403, "この共同の書架には参加していません")


def attach_tags(session: Session, entry: Entry, tag_names: List[str]):
    for raw in tag_names:
        name = raw.lstrip("#").strip()
        if not name:
            continue
        existing = session.exec(select(Tag).where(Tag.name == name)).first()
        if existing:
            entry.tags.append(existing)
        else:
            entry.tags.append(Tag(name=name, category=map_tag_to_category(name)))


def add_months_iso(base_iso: str, months: int) -> str:
    d = date.fromisoformat(base_iso)
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day).isoformat()


# ---------- ライブラリ一括取得 ----------
@router.get("/library")
def get_library(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    books = visible_books(session, user)
    return {
        "books": [serialize_book(b, list(b.entries), viewer_id=user.id) for b in books],
        "flags": {
            "publishEnabled": settings.PUBLISH_ENABLED,
            "publishRequireResolved": settings.PUBLISH_REQUIRE_RESOLVED,
            "publishEditMode": settings.PUBLISH_EDIT_MODE,
            "publishToSenpai": settings.PUBLISH_TO_SENPAI,
            "referenceLinks": settings.REFERENCE_LINKS_ENABLED,
            "fixWindowSeconds": settings.FIX_WINDOW_SECONDS,
        },
    }


# ---------- 合言葉で既存の共同の書架に参加する ----------
class JoinSharedRequest(BaseModel):
    passcode: str


@router.post("/shared/join")
def join_shared(
    data: JoinSharedRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    passcode = data.passcode.strip()
    if not passcode:
        raise HTTPException(400, "合言葉を入力してください")
    book = session.exec(
        select(Book).where(Book.shelf == Shelf.SHARED, Book.passcode == passcode)
    ).first()
    if not book:
        raise HTTPException(404, "その合言葉に一致する共同の書架が見つかりません")
    if book.owner_id != user.id and not session.get(SharedMembership, (book.id, user.id)):
        session.add(SharedMembership(book_id=book.id, user_id=user.id))
        session.commit()
        session.refresh(book)
    return serialize_book(book, list(book.entries), viewer_id=user.id)


# ---------- 本の作成 ----------
class BookCreate(BaseModel):
    shelf: Shelf
    title: str
    passcode: Optional[str] = None  # shared のみ必須(4文字以上)
    fill: Optional[str] = None
    height: Optional[int] = None


PALETTE = ["#1f4f68", "#54432b", "#422a54", "#25413c", "#5a1730"]


def claim_shared_passcode(session: Session, raw: Optional[str]) -> str:
    passcode = (raw or "").strip()
    if len(passcode) < settings.SHARED_PASSCODE_MIN_LEN:
        raise HTTPException(400, f"共同の書架には{settings.SHARED_PASSCODE_MIN_LEN}文字以上の合言葉が必要です")
    exists = session.exec(
        select(Book).where(Book.shelf == Shelf.SHARED, Book.passcode == passcode)
    ).first()
    if exists:
        raise HTTPException(400, "その合言葉はすでに使われています。別の合言葉にしてください")
    return passcode


@router.post("/books")
def create_book(
    data: BookCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if data.shelf == Shelf.SENPAI and not settings.PUBLISH_TO_SENPAI:
        raise HTTPException(403, "先達の書架に直接は置けません(B-4 未決)")
    passcode = claim_shared_passcode(session, data.passcode) if data.shelf == Shelf.SHARED else None
    count = len(session.exec(select(Book)).all())
    book = Book(
        shelf=data.shelf,
        title=data.title.strip()[:12],
        fill=data.fill or PALETTE[count % len(PALETTE)],
        height=data.height or 145,
        owner_id=user.id,
        passcode=passcode,
    )
    session.add(book)
    session.commit()
    session.refresh(book)
    return serialize_book(book, [], viewer_id=user.id, reveal_passcode=True)


# ---------- 記録を綴じる ----------
class EntryCreate(BaseModel):
    title: str
    body: str
    tags: List[str] = []
    confidence: int = 3
    resolveDate: Optional[str] = None  # None なら PENDING_DEFAULT_MONTHS 後


@router.post("/books/{book_id}/entries")
def create_entry(
    book_id: int,
    data: EntryCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    book = get_book_or_404(session, book_id)
    assert_writable(session, book, user)
    if not data.body.strip():
        raise HTTPException(400, "本文を書いてから綴じられます")
    today = date.today().isoformat()
    resolve = data.resolveDate or add_months_iso(today, settings.PENDING_DEFAULT_MONTHS)
    entry = Entry(
        book_id=book.id,
        author_id=user.id,
        date=today,
        title=data.title.strip() or f"{book.title}への追記",
        body=data.body.strip(),
        confidence=max(1, min(5, data.confidence)),
        outcome=Outcome.PENDING,
        resolve_date=resolve,
    )
    session.add(entry)
    attach_tags(session, entry, data.tags)
    session.commit()
    session.refresh(entry)
    # 意味検索用ベクトル(候補A)。モデル未ロードなら起動時/検索時に補完される。
    # 失敗しても記録の保存は絶対に巻き添えにしない。
    try:
        embeddings.upsert_entry_embedding(session, entry)
    except Exception as e:
        print(f"[recall] ベクトル計算をスキップ: {e}")
    return serialize_entry(entry)


# ---------- 結果を綴じる ----------
class ResolveRequest(BaseModel):
    outcome: Outcome                     # ok | ng
    judgment: Judgment                   # sound | flawed(必須: 結果と判断は別)
    reasonOutcome: str = ""
    reasonJudgment: str = ""


@router.post("/entries/{entry_id}/resolve")
def resolve_entry(
    entry_id: int,
    data: ResolveRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    assert_writable(session, entry.book, user)
    if data.outcome == Outcome.PENDING:
        raise HTTPException(400, "結果は ok / ng で綴じてください")
    entry.outcome = data.outcome
    entry.judgment = data.judgment
    entry.reason_outcome = data.reasonOutcome.strip()
    entry.reason_judgment = data.reasonJudgment.strip()
    entry.resolved_on = date.today().isoformat()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return serialize_entry(entry)


# ---------- まだ分からない(1ヶ月延期) ----------
@router.post("/entries/{entry_id}/postpone")
def postpone_entry(
    entry_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    assert_writable(session, entry.book, user)
    new_date = add_months_iso(date.today().isoformat(), 1)
    entry.resolve_date = new_date
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return serialize_entry(entry)


# ---------- 追記 ----------
class AppendRequest(BaseModel):
    text: str


@router.post("/entries/{entry_id}/appends")
def append_entry(
    entry_id: int,
    data: AppendRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    assert_writable(session, entry.book, user)
    if not data.text.strip():
        raise HTTPException(400, "追記の本文を書いてください")
    ap = EntryAppend(
        entry_id=entry.id,
        author_id=user.id,
        date=date.today().isoformat(),
        text=data.text.strip(),
    )
    session.add(ap)
    session.commit()
    session.refresh(entry)
    return serialize_entry(entry)


# ---------- FIX_WINDOW内の取り下げ(修正して書き直す) ----------
@router.delete("/entries/{entry_id}")
def withdraw_entry(
    entry_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    if entry.author_id != user.id:
        raise HTTPException(403, "自分の記録のみ取り下げられます")
    age = (datetime.now() - entry.saved_at).total_seconds()
    if age >= settings.FIX_WINDOW_SECONDS:
        raise HTTPException(
            403,
            f"綴じてから{settings.FIX_WINDOW_SECONDS // 60}分を過ぎた記録は編集できません。追記で重ねてください。",
        )
    payload = serialize_entry(entry)
    for a in list(entry.appends):
        session.delete(a)
    entry.tags.clear()
    from app.models import EntryEmbedding
    emb_row = session.get(EntryEmbedding, entry.id)
    if emb_row:
        session.delete(emb_row)
    session.delete(entry)
    session.commit()
    return {"withdrawn": payload}
