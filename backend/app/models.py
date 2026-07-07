from enum import Enum
from typing import Optional, List
from datetime import datetime
# pyrefly: ignore [missing-import]
from sqlmodel import SQLModel, Field, Relationship

class Layer(str, Enum):
    VISION = "VISION"
    PIVOT = "PIVOT"
    LIFE = "LIFE"

class Flag(str, Enum):
    SUCCESS = "SUCCESS"
    REGRET = "REGRET"

class PivotTagLink(SQLModel, table=True):
    __tablename__ = "pivot_tag_link"
    pivot_id: Optional[int] = Field(default=None, foreign_key="pivot.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)

class Pivot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    content: str  # 悩み・本文
    layer: Layer = Field(default=Layer.PIVOT)  # PIVOT/VISION/LIFE
    flag: Optional[Flag] = Field(default=None)  # SUCCESS/REGRET
    confidence: Optional[int] = Field(default=None)  # 確信度 (1-5)
    image_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Many-to-many relationship
    tags: List["Tag"] = Relationship(back_populates="pivots", link_model=PivotTagLink)

class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)  # 例: "#絶望"
    category: str  # 例: "感情", "課題" など

    # Many-to-many relationship
    pivots: List["Pivot"] = Relationship(back_populates="tags", link_model=PivotTagLink)
