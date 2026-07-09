"""
アウトカムバイアス検出API(候補B・T2)

POST /api/entries/{id}/bias-check
  結果を綴じる「前」にフロントから呼ばれる。綴じる処理そのものとは独立で、
  このAPIが落ちてもフロントは何も表示せず普通に綴じる。

介入ログ(BiasCheck)を必ず残す: 問いを出した/出さなかったの記録があると、
介入あり・なしで後のキャリブレーションを比較できる(製品自身が実験装置になる)。
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.models import Entry, User, BiasCheck
from app.auth.deps import get_current_user
from app.routers.library import assert_writable
from app.services import bias_check

router = APIRouter(prefix="/api", tags=["bias-check"])


class BiasCheckRequest(BaseModel):
    outcome: str  # "ok" | "ng"
    judgment: str  # "sound" | "flawed"
    reasonOutcome: str = ""
    reasonJudgment: str = ""


class BiasCheckResponse(BaseModel):
    available: bool
    biasSuspected: bool
    question: str | None


@router.post("/entries/{entry_id}/bias-check", response_model=BiasCheckResponse)
def check_bias(
    entry_id: int,
    data: BiasCheckRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = session.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "記録が見つかりません")
    assert_writable(session, entry.book, user)

    result = bias_check.check(
        entry,
        outcome=data.outcome,
        judgment=data.judgment,
        reason_outcome=data.reasonOutcome,
        reason_judgment=data.reasonJudgment,
    )

    # 介入ログ(判定が実行できたときだけ)
    if result["available"]:
        from app import settings

        session.add(
            BiasCheck(
                entry_id=entry.id,
                user_id=user.id,
                judgment=data.judgment,
                checked_reason=data.reasonJudgment,
                bias_suspected=result["bias_suspected"],
                question=result["question"] or "",
                llm_model=settings.GEMINI_MODEL,
            )
        )
        session.commit()

    return BiasCheckResponse(
        available=result["available"],
        biasSuspected=result["bias_suspected"],
        question=result["question"],
    )
