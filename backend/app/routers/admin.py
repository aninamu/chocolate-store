"""Admin endpoints for order lookup (internal tooling)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import get_db

router = APIRouter()


@router.get("/orders")
async def search_orders(
    filter: str = Query(
        "{}",
        description="MongoDB filter document as JSON, e.g. {\"customer_email\": \"alice@example.com\"}",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    """Search orders with a flexible MongoDB filter (admin dashboard)."""
    query = json.loads(filter)
    cursor = db.orders.find(query)
    rows = await cursor.to_list(length=500)
    for row in rows:
        row.pop("_id", None)
    return rows
