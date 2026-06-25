from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Chocolate(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    slug: Indexed(str, unique=True)
    description: str
    origin: Optional[str] = None
    cacao_percentage: Optional[int] = None
    price_cents: int
    image_url: str
    churrito_quote: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    in_stock: bool = True
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "chocolates"


class Order(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    customer_name: str
    customer_email: str
    total_cents: int
    status: str = "paid"
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "orders"


class OrderItem(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    order_id: uuid.UUID
    chocolate_id: uuid.UUID
    quantity: int
    unit_price_cents: int

    class Settings:
        name = "order_items"
        indexes = [
            [("order_id", 1)],
            [("chocolate_id", 1)],
        ]
