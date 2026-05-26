from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class DemoUserOut(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str
    is_moderator: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductChipOut(BaseModel):
    id: uuid.UUID
    name: str
    image_url: str
    price_cents: int

    model_config = {"from_attributes": True}


class PostOut(BaseModel):
    id: uuid.UUID
    text: str
    image_url: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
    author: DemoUserOut
    product: Optional[ProductChipOut] = None
    like_count: int
    comment_count: int
    liked_by_me: bool = False


class PostDetailOut(PostOut):
    comments: list["CommentOut"] = Field(default_factory=list)


class PostCreateIn(BaseModel):
    text: str = Field(min_length=1, max_length=280)
    chocolate_id: Optional[uuid.UUID] = None
    image_url: Optional[HttpUrl] = None


class CommentOut(BaseModel):
    id: uuid.UUID
    text: str
    created_at: datetime
    deleted_at: Optional[datetime] = None
    author: DemoUserOut

    model_config = {"from_attributes": True}


class CommentCreateIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class FeedOut(BaseModel):
    items: list[PostOut]
    next_offset: Optional[int] = None


class ReportCreateIn(BaseModel):
    entity_type: Literal["post", "comment"]
    entity_id: uuid.UUID
    reason: Optional[str] = Field(default=None, max_length=500)


class ReportOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    reason: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    reporter: DemoUserOut

    model_config = {"from_attributes": True}


class UserProfileOut(BaseModel):
    user: DemoUserOut
    post_count: int
