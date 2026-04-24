import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class ChocolateOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str
    origin: Optional[str] = None
    cacao_percentage: Optional[int] = None
    price_cents: int
    image_url: str
    tags: List[str]
    in_stock: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CartLineIn(BaseModel):
    chocolate_id: uuid.UUID
    quantity: int = Field(ge=1, le=99)


class CheckoutIn(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    customer_email: EmailStr
    items: List[CartLineIn] = Field(min_length=1)


class CheckoutOut(BaseModel):
    order_id: uuid.UUID
    total_cents: int
