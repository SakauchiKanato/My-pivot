"""
タグ整理ロジック（ルールベース）

ユーザーが入力した感情タグ（例：#絶望）を、
検索可能なカテゴリ（例：感情）に自動変換する。

設計方針（過去の議論を反映）：
- まずルールベースで確実に動かす（無料・高速・予測可能）
- 将来 LLM を足す場合は、辞書に無いタグだけをフォールバックで LLM に渡す
  → llm_mapper.py に切り出し可能な設計にしている
"""

# タグ → カテゴリ のマッピング辞書
# キーワードが含まれていればそのカテゴリに分類する
TAG_RULES = {
    "感情": ["絶望", "つらい", "しんどい", "どうしよう", "不安", "怖い",
             "迷い", "もやもや", "落ち込み", "焦り", "泣きたい"],
    "意思決定": ["就活", "院進", "進路", "選択", "決断", "迷う", "どっち",
                 "転換", "ピボット", "分岐"],
    "研究": ["研究", "実験", "論文", "ゼミ", "研究室", "教授", "先生", "テーマ"],
    "学習": ["勉強", "テスト", "試験", "課題", "単位", "授業", "統計", "数学"],
    "人間関係": ["友達", "親", "family", "先輩", "後輩", "同期", "恋愛"],
    "成長": ["成長", "達成", "できた", "挑戦", "スキル", "自信"],
}

DEFAULT_CATEGORY = "その他"


def map_tag_to_category(tag_name: str) -> str:
    """
    タグ名からカテゴリを判定する。

    Args:
        tag_name: ユーザーが入力したタグ（先頭の # はあってもなくても可）
    Returns:
        カテゴリ名（該当なしの場合は「その他」）
    """
    # 先頭の # を除去して正規化
    normalized = tag_name.lstrip("#").strip().lower()

    for category, keywords in TAG_RULES.items():
        for keyword in keywords:
            if keyword.lower() in normalized:
                return category

    # --- ここで将来 LLM フォールバックを呼べる ---
    # if USE_LLM:
    #     return llm_mapper.classify(tag_name)

    return "その他"


def map_tags(tag_names: list[str]) -> list[dict]:
    """複数タグをまとめて変換する。"""
    return [
        {"name": name, "category": map_tag_to_category(name)}
        for name in tag_names
    ]
