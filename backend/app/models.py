"""
データモデル定義

My Pivot のデータ構造を定義する。
- User:  ユーザーアカウント（ログイン機能）
- Pivot: 1つの選択・迷いの記録
- Tag:   感情タグ（カテゴリ付き）

過去の設計議論を反映：
- confidence（当時の確信度）を flag（今の評価）と分離 → 後知恵バイアス対策
- layer（3層アーキテクチャ）でビジョン/ピボット/ライフを区別
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship


class Layer(str, Enum):
    """3層アーキテクチャ：情報の肥大化を構造的に防ぐ"""
    VISION = "vision"   # ビジョン（長期目標）
    PIVOT = "pivot"     # ピボット（転換点）
    LIFE = "life"       # ライフ（日常）


class Flag(str, Enum):
    """選択の評価（後から付与）"""
    SUCCESS = "success"  # 成功
    REGRET = "regret"    # 後悔


# --- ユーザーモデル ---
class User(SQLModel, table=True):
    """ログインユーザー。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)

    # リレーション：ユーザーが持つピボット一覧
    pivots: List["Pivot"] = Relationship(back_populates="user")


# --- 中間テーブル（Pivot と Tag の多対多をつなぐ） ---
class PivotTagLink(SQLModel, table=True):
    pivot_id: Optional[int] = Field(
        default=None, foreign_key="pivot.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    """感情タグ。name はユーザーが入力、category は自動付与される。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)          # 例：#絶望
    category: str                          # 変換後カテゴリ：感情
    pivots: List["Pivot"] = Relationship(
        back_populates="tags", link_model=PivotTagLink
    )


class Pivot(SQLModel, table=True):
    """1つの選択・迷いの記録。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str                                      # タイトル（命名）
    content: str                                    # 五里霧中の悩み（本文）
    layer: Layer = Field(default=Layer.PIVOT)       # 3層
    flag: Optional[Flag] = Field(default=None)      # 成功/後悔（今の評価）
    confidence: Optional[int] = Field(default=None) # 当時の確信度 1-5
    image_url: Optional[str] = Field(default=None)  # 添付画像
    created_at: datetime = Field(default_factory=datetime.now)  # 「いつ」検索軸
    reason_judgment: Optional[str] = Field(default=None)
    ai_question: Optional[str] = Field(default=None)            # AIからの問いかけ
    is_ai_intervened: bool = Field(default=False)               # AI介入があったかどうか
    ai_chat_history: Optional[str] = Field(default=None)        # AIとの葛藤のチャット履歴(JSON文字列)

    # ユーザーとの紐付け（外部キー）
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="pivots")

    tags: List[Tag] = Relationship(
        back_populates="pivots", link_model=PivotTagLink
    )
