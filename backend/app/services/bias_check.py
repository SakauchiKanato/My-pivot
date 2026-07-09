"""
アウトカムバイアス検出(AI候補B・T2)

結果を綴じるとき、「当時の判断について」(reasonJudgment)に
決定時には知り得なかった情報(=結果)から判断を評価する推論が
混入していないかをLLMが判定し、疑いがあれば「問い」を1つ返す。

設計制約:
- 断定しない。返すのは常に疑問形の問い1つだけ
- 綴じるのを妨げない(問いは表示されるが、ユーザーはそのまま綴じられる)
- 決定時の記録(entry.body)が不変だから「当時知り得た情報」が確定している
  → これが書き換え可能な日記アプリでは原理的に不可能な照合(Q&A防御)
- LLMは body に書かれていない「頭の中」を推測できない → 誤検出は起こり得る。
  だからこそ出力を問いに限定し、誤判定のコストを「よけいな問い1つ」に抑える

Gemini API を使用。GEMINI_API_KEY 未設定・障害時は available=False を返し、
フロントは何も表示せず普通に綴じる(デモが止まらない)。

テスト用フック: MY_PIVOT_FAKE_LLM=1 でルールベースの擬似判定に切り替わる。
"""
import json
import os
from typing import Optional, TypedDict

from app import settings
from app.models import Entry


class BiasCheckResult(TypedDict):
    available: bool
    bias_suspected: bool
    question: Optional[str]


def _unavailable() -> BiasCheckResult:
    return {"available": False, "bias_suspected": False, "question": None}


_PROMPT = """あなたは意思決定記録アプリ「My Pivot」の振り返り支援です。
ユーザーが過去の決断に「結果」を綴じようとしています。

このアプリの核となる思想: 「結果(outcome)」と「判断の質(judgment)」は別物です。
良い判断が悪い結果になることも、その逆もあります(Baron & Hershey, 1988 のアウトカムバイアス)。

# 決定時の記録(この時点の情報しかユーザーは持っていなかった)
決定日: {date}
タイトル: {title}
本文:
{body}
決定時の見込み(1-5): {confidence}

# いま綴じようとしている内容
結果: {outcome_label}
結果について: {reason_outcome}
当時の判断の評価: {judgment_label}
当時の判断について: {reason_judgment}

# あなたの仕事
「当時の判断について」の文章が、決定時には知り得なかった情報(=結果がどうなったか)を
根拠にして判断の質を評価していないかを判定してください。

典型例: 「結局失敗したから、あの判断は間違っていた」「うまくいったから正しい判断だった」

判定のルール:
- 疑いがある場合のみ bias_suspected を true にし、question に「問い」を1つだけ書く
- 問いは必ず疑問形。断定・説教・アドバイスは禁止
- 問いには決定日({date})を含め、「その時点で持っていた情報だけで見るとどうだったか」を
  たずねる形にする
- 本文に書かれていないことを「知っていたはず」と決めつけない
- 結果の良し悪しと無関係に判断プロセス自体を評価している文章は bias_suspected: false
- 迷ったら false(問いすぎは体験を壊す)
- 問いは日本語で、2文以内、やわらかい口調で

次のJSONだけを出力してください:
{{"bias_suspected": true または false, "question": "問いの文字列(falseならnull)"}}"""

_OUTCOME_LABEL = {"ok": "うまくいった", "ng": "後悔が残る"}
_JUDGMENT_LABEL = {"sound": "判断は妥当だった", "flawed": "判断にも悔いがある"}


def _build_prompt(entry: Entry, outcome: str, judgment: str, reason_outcome: str, reason_judgment: str) -> str:
    return _PROMPT.format(
        date=entry.date,
        title=entry.title,
        body=entry.body,
        confidence=entry.confidence,
        outcome_label=_OUTCOME_LABEL.get(outcome, outcome),
        reason_outcome=reason_outcome or "(未記入)",
        judgment_label=_JUDGMENT_LABEL.get(judgment, judgment),
        reason_judgment=reason_judgment,
    )


def _fake_check(entry: Entry, reason_judgment: str) -> BiasCheckResult:
    """MY_PIVOT_FAKE_LLM=1 用のルールベース判定(テスト・オフラインデモ用)。"""
    markers = ["結局", "から間違", "から正し", "失敗したから", "うまくいったから", "結果的に"]
    hit = any(m in reason_judgment for m in markers)
    q = (
        f"それは結果から判断を評価していませんか? "
        f"{entry.date}の時点であなたが持っていた情報だけで見て、あの決め方はどうでしたか?"
    )
    return {"available": True, "bias_suspected": hit, "question": q if hit else None}


def check(entry: Entry, outcome: str, judgment: str, reason_outcome: str, reason_judgment: str) -> BiasCheckResult:
    if not settings.BIAS_CHECK_ENABLED:
        return _unavailable()
    if not reason_judgment.strip():
        # 判定対象の文章がなければ何もしない
        return {"available": True, "bias_suspected": False, "question": None}

    if os.environ.get("MY_PIVOT_FAKE_LLM") == "1":
        return _fake_check(entry, reason_judgment)

    if not settings.GEMINI_API_KEY:
        return _unavailable()

    try:
        import time

        import requests

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": _build_prompt(entry, outcome, judgment, reason_outcome, reason_judgment)}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        resp = None
        for attempt in range(3):  # 503/429(過負荷)は一過性が多いので短いリトライを2回
            resp = requests.post(
                url,
                headers={"x-goog-api-key": settings.GEMINI_API_KEY},
                json=payload,
                timeout=settings.BIAS_CHECK_TIMEOUT_SECONDS,
            )
            if resp.status_code not in (429, 503):
                break
            if attempt < 2:
                print(f"[bias-check] {resp.status_code} のためリトライ({attempt + 1}/2)")
                time.sleep(1.5)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
        suspected = bool(data.get("bias_suspected"))
        question = data.get("question") if suspected else None
        if suspected and not (isinstance(question, str) and question.strip()):
            # 問いのない検出は返さない(断定だけになるのを防ぐ)
            return {"available": True, "bias_suspected": False, "question": None}
        return {"available": True, "bias_suspected": suspected, "question": question}
    except Exception as e:
        print(f"[bias-check] 判定をスキップ(綴じる動作には影響なし): {e}")
        return _unavailable()
