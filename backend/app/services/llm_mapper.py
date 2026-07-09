"""
タグ・カテゴリ自動マッピングのLLMフォールバック

tag_mapper.py のルール辞書にヒットしなかったタグだけがここに来る。
Geminiに既定カテゴリのどれかを選ばせ、JSONで受け取る。

設計上の位置づけ:
- 分類が走るのは Tag の新規作成時のみ(既存タグはDBのカテゴリを再利用)
  → API呼び出しはタグ1種類につき生涯1回。コストも遅延も最小
- カテゴリは検索・計器のための裏方メタデータで、決定時のUIには何も出さない
  → T1(決定時)にAIが答えを出さない、の制約に抵触しない
- タグに名前をつける行為そのものはユーザーの手に残す(自動付与はしない)

キー未設定・障害・タイムアウト時は DEFAULT_CATEGORY(その他)に落ちるだけで、
記録の保存は一切妨げない。

テスト用フック: MY_PIVOT_FAKE_LLM=1 で決定的な擬似分類に切り替わる。
"""
import json
import os
from typing import Optional

from app import settings

# カテゴリの正は tag_mapper 側(循環importを避けるため遅延で参照する)


def _categories() -> list[str]:
    from app.services.tag_mapper import TAG_RULES, DEFAULT_CATEGORY

    return list(TAG_RULES.keys()) + [DEFAULT_CATEGORY]


_PROMPT = """あなたは意思決定記録アプリのタグ整理係です。
ユーザーが自由に書いたタグを、次のカテゴリのどれか1つに分類してください。

カテゴリ: {categories}

タグ: 「{tag}」

分類のルール:
- 迷いや気持ちの表現(例: どうしよう、眠れない、無理かも)は「感情」
- 進路・選択・決断に関わる語は「意思決定」
- どれにも当てはまらない・判断できない場合は「その他」
- カテゴリ名はリストにあるものを一字一句そのまま使うこと

次のJSONだけを出力してください:
{{"category": "カテゴリ名"}}"""


def _fake_classify(tag: str) -> str:
    """MY_PIVOT_FAKE_LLM=1 用。emo→感情 だけ返す決定的スタブ。"""
    return "感情" if "emo" in tag.lower() else "その他"


def classify(tag: str) -> Optional[str]:
    """
    タグをLLMで分類する。成功したらカテゴリ名、使えないときは None
    (呼び出し側が DEFAULT_CATEGORY にする)。
    """
    if not settings.TAG_LLM_ENABLED:
        return None
    if os.environ.get("MY_PIVOT_FAKE_LLM") == "1":
        return _fake_classify(tag)
    if not settings.GEMINI_API_KEY:
        return None

    cats = _categories()
    try:
        import requests

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent"
        )
        resp = requests.post(
            url,
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={
                "contents": [
                    {"parts": [{"text": _PROMPT.format(categories="、".join(cats), tag=tag)}]}
                ],
                "generationConfig": {
                    "temperature": 0.0,
                    "responseMimeType": "application/json",
                },
            },
            timeout=settings.TAG_LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        category = json.loads(text).get("category", "")
        # LLMがリスト外のカテゴリを発明したら捨てる(カテゴリ体系を守る)
        return category if category in cats else None
    except Exception as e:
        print(f"[tag-llm] 分類をスキップ(その他になります): {e}")
        return None
