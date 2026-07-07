from typing import Optional, List
from datetime import datetime
# pyrefly: ignore [missing-import]
from sqlmodel import SQLModel, Field, Relationship

class Pivot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    description: str
    certainty: int = Field(default=50)  # 確信度 (0-100)
    status: str = Field(default="fog")  # "fog" (五里霧中), "success" (成功), "regret" (後悔)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    tags: List["Tag"] = Relationship(back_populates="pivot", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    category: str  # Category like "emotion" (感情), "career" (進路) etc.
    pivot_id: int = Field(foreign_key="pivot.id", index=True)

    pivot: Optional[Pivot] = Relationship(back_populates="tags")
