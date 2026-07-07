# ルールベースの辞書
TAG_CATEGORY_MAPPING = {
    # 感情カテゴリ
    "絶望": "感情",
    "つらい": "感情",
    "どうしよう": "感情",
    "不安": "感情",
    "悩み": "感情",
    "嬉しい": "感情",
    "楽しい": "感情",
    
    # 意思決定カテゴリ
    "進路": "意思決定",
    "就活": "意思決定",
    "院進": "意思決定",
    "転職": "意思決定",
    "選択": "意思決定",
    "決断": "意思決定",
}

def map_tag_to_category(tag_name: str) -> str:
    # 先頭の '#' を除去
    clean_name = tag_name.lstrip('#')
    
    # 完全一致、または部分一致でカテゴリを探す
    for key, category in TAG_CATEGORY_MAPPING.items():
        if key in clean_name:
            return category
            
    # 一致しない場合は「その他」
    return "その他"
