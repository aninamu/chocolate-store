from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProductSnapshot(BaseModel):
    name: str
    slug: str


class OrderItemEmbedded(BaseModel):
    chocolate_id: uuid.UUID
    quantity: int
    unit_price_cents: int
    product_snapshot: Optional[ProductSnapshot] = None


class ChocolateDocument(Document):
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
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "chocolates"
        indexes = [
            IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
            IndexModel([("tags", ASCENDING)], name="tags_1"),
            IndexModel([("name", ASCENDING)], name="name_1"),
            IndexModel(
                [("price_cents", ASCENDING), ("name", ASCENDING)],
                name="price_cents_1_name_1",
            ),
            IndexModel(
                [("price_cents", DESCENDING), ("name", ASCENDING)],
                name="price_cents_-1_name_1",
            ),
            IndexModel(
                [("cacao_percentage", DESCENDING), ("name", ASCENDING)],
                name="cacao_percentage_-1_name_1",
            ),
        ]


class OrderDocument(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    customer_name: str
    customer_email: str
    total_cents: int
    status: str = "paid"
    created_at: datetime = Field(default_factory=_utcnow)
    items: List[OrderItemEmbedded] = Field(default_factory=list)

    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("created_at", DESCENDING)], name="created_at_-1"),
            IndexModel(
                [("customer_email", ASCENDING), ("created_at", DESCENDING)],
                name="customer_email_1_created_at_-1",
            ),
            IndexModel(
                [("items.chocolate_id", ASCENDING)],
                name="items_chocolate_id_1",
            ),
            IndexModel(
                [("status", ASCENDING), ("created_at", DESCENDING)],
                name="status_1_created_at_-1",
            ),
        ]
