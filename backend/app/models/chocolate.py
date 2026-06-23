from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from pydantic import BaseModel, Field


def new_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ChocolateDoc(BaseModel):
    """MongoDB document shape for the chocolates collection."""

    id: str = Field(default_factory=new_uuid)
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
    created_at: datetime = Field(default_factory=utc_now)

    def to_mongo(self) -> dict[str, Any]:
        doc = self.model_dump()
        doc["_id"] = doc["id"]
        return doc

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "ChocolateDoc":
        data = dict(doc)
        data.pop("_id", None)
        if "id" not in data and "_id" in doc:
            data["id"] = str(doc["_id"])
        return cls.model_validate(data)


class OrderItemDoc(BaseModel):
    chocolate_id: str
    quantity: int
    unit_price_cents: int


class OrderDoc(BaseModel):
    """MongoDB document shape for the orders collection."""

    id: str = Field(default_factory=new_uuid)
    customer_name: str
    customer_email: str
    total_cents: int
    status: str = "paid"
    items: List[OrderItemDoc] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)

    def to_mongo(self) -> dict[str, Any]:
        doc = self.model_dump()
        doc["_id"] = doc["id"]
        return doc

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> "OrderDoc":
        data = dict(doc)
        data.pop("_id", None)
        if "id" not in data and "_id" in doc:
            data["id"] = str(doc["_id"])
        return cls.model_validate(data)
