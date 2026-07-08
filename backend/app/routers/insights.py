"""
通知と計器のAPI

v3 の集計をサーバー側に移植。DB が真実の源になるため、
localStorage 版と違い複数端末・複数ユーザーで一貫する。

- GET /api/notifications/due   結果予定日が来た自分の記録
- GET /api/stats/calibration   全体計器(★別成功率、タグ別、n数)

計器の対象: 自分が author の記録のうち先達棚以外(v3 の ownEntries と同義)。
公開コピー(source_entry_id あり)は二重計上を防ぐため除外する。
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Entry, Book, Shelf, Outcome, User
from app.auth.deps import get_current_user
from app.routers.library import serialize_entry

router = APIRouter(prefix="/api", tags=["insights"])

MID = {1: 10, 2: 30, 3: 50, 4: 70, 5: 90}  # 各★の目安(区間中点)


def own_entries(session: Session, user: User):
    rows = session.exec(
        select(Entry, Book).where(Entry.book_id == Book.id)
    ).all()
    return [
        e for (e, b) in rows
        if b.shelf != Shelf.SENPAI
        and e.author_id == user.id
        and e.source_entry_id is None
    ]


@router.get("/notifications/due")
def due_notifications(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    today = date.today().isoformat()
    due = [
        e for e in own_entries(session, user)
        if e.outcome == Outcome.PENDING and e.resolve_date and e.resolve_date <= today
    ]
    return [serialize_entry(e) for e in due]


@router.get("/stats/calibration")
def calibration(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    own = own_entries(session, user)
    resolved = [e for e in own if e.outcome in (Outcome.OK, Outcome.NG)]
    ok_n = sum(1 for e in resolved if e.outcome == Outcome.OK)

    buckets = {c: {"n": 0, "ok": 0} for c in range(1, 6)}
    for e in resolved:
        c = min(5, max(1, e.confidence or 3))
        buckets[c]["n"] += 1
        if e.outcome == Outcome.OK:
            buckets[c]["ok"] += 1

    tag_map: dict = {}
    for e in resolved:
        for t in e.tags:
            tag_map.setdefault(t.name, {"n": 0, "ok": 0})
            tag_map[t.name]["n"] += 1
            if e.outcome == Outcome.OK:
                tag_map[t.name]["ok"] += 1

    return {
        "total": len(own),
        "resolvedN": len(resolved),
        "okRate": round(ok_n / len(resolved) * 100) if resolved else None,
        "avgConf": (sum((e.confidence or 3) for e in own) / len(own)) if own else 0,
        "buckets": {
            str(c): {
                "n": b["n"],
                "ok": b["ok"],
                "rate": round(b["ok"] / b["n"] * 100) if b["n"] else None,
                "mid": MID[c],
            }
            for c, b in buckets.items()
        },
        "tags": [
            {"tag": name, "n": v["n"], "rate": round(v["ok"] / v["n"] * 100)}
            for name, v in tag_map.items()
        ],
    }
