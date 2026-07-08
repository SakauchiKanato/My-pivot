"""
データモデル定義(v3 UI 準拠)

v3 で確立した設計判断を反映:
- Book(本) / Entry(記録) の2階層。棚は mine / shared / senpai の3種
- outcome(結果: ok/ng/pending) と judgment(判断: sound/flawed) を分離
  → アウトカムバイアス対策(結果と判断プロセスを別評価)
- confidence は「決定時」に記録し、以後変更不可 → 後知恵バイアス対策
- 記録は編集不可(FIX_WINDOW内の削除のみ)。追記は EntryAppend で重ねる
- 公開は原本のコピー(source_entry_id で出自を保持)。原本は動かさない
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship


class Shelf(str, Enum):
    MINE = "mine"        # わたしの書架(非公開)
    SHARED = "shared"    # 共同の書架(仲間と共有)
    SENPAI = "senpai"    # 先達の書架(読み専用)


class Outcome(str, Enum):
    OK = "ok"            # うまくいった
    NG = "ng"            # 後悔が残る
    PENDING = "pending"  # 結果待ち


class Judgment(str, Enum):
    SOUND = "sound"      # 判断は妥当だった
    FLAWED = "flawed"    # 判断にも悔いがある


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str = Field(default="")   # OAuth ユーザーは空
    auth_provider: str = Field(default="local")  # "local" | "google"
    created_at: datetime = Field(default_factory=datetime.now)


class Book(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shelf: Shelf = Field(index=True)
    title: str
    fill: str = Field(default="#1f4f68")   # 背表紙の色
    height: int = Field(default=145)       # 背表紙の高さ(px)
    # mine の本は owner のみ閲覧可。shared/senpai は owner_id が作成者記録用
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    # shared の本だけが持つ合言葉。これを知っている人だけが参加(join)できる
    passcode: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.now)

    entries: List["Entry"] = Relationship(back_populates="book")


class SharedMembership(SQLModel, table=True):
    """合言葉でshared本に参加した記録。作成者はowner_idで判定するのでここには入れない。"""
    book_id: Optional[int] = Field(default=None, foreign_key="book.id", primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    joined_at: datetime = Field(default_factory=datetime.now)


class EntryTagLink(SQLModel, table=True):
    entry_id: Optional[int] = Field(default=None, foreign_key="entry.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    category: str = Field(default="その他")  # tag_mapper による自動分類
    entries: List["Entry"] = Relationship(back_populates="tags", link_model=EntryTagLink)


class Entry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: int = Field(foreign_key="book.id", index=True)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)

    date: str                                   # 決定日 "YYYY-MM-DD"
    title: str
    body: str
    confidence: int = Field(default=3)          # 決定時の見込み 1-5(不変)

    outcome: Outcome = Field(default=Outcome.PENDING)
    judgment: Optional[Judgment] = Field(default=None)
    reason_outcome: str = Field(default="")     # 結果について、ひとこと
    reason_judgment: str = Field(default="")    # 当時の判断について、ひとこと
    resolve_date: Optional[str] = Field(default=None)  # 結果がわかりそうな日
    resolved_on: Optional[str] = Field(default=None)   # 結果を綴じた日

    # 公開コピーの出自(nullなら原本)
    source_entry_id: Optional[int] = Field(default=None, foreign_key="entry.id")

    saved_at: datetime = Field(default_factory=datetime.now)  # FIX_WINDOW 判定用

    book: Optional[Book] = Relationship(back_populates="entries")
    tags: List[Tag] = Relationship(back_populates="entries", link_model=EntryTagLink)
    appends: List["EntryAppend"] = Relationship(back_populates="entry")


class EntryAppend(SQLModel, table=True):
    """追記。原本は書き換えず、日付つきで下に重ねる。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entry.id", index=True)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    date: str
    text: str

    entry: Optional[Entry] = Relationship(back_populates="appends")
