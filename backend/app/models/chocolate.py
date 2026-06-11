from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OrderLine(BaseModel):
    chocolate_id: uuid.UUID
    quantity: int
    unit_price_cents: int


class Chocolate(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    slug: str
    description: str
    origin: Optional[str] = None
    cacao_percentage: Optional[int] = None
    price_cents: int
    image_url: str
    churrito_quote: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    in_stock: bool = True
    created_at: datetime = Field(default_factory=_utc_now)

    class Settings:
        name = "chocolates"
        indexes = [
            IndexModel([("slug", 1)], unique=True),
            IndexModel([("tags", 1)]),
        ]


class Order(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    customer_name: str
    customer_email: str
    total_cents: int
    status: str = "paid"
    created_at: datetime = Field(default_factory=_utc_now)
    items: List[OrderLine] = Field(default_factory=list)

    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("created_at", -1)]),
        ]
