from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import get_db
from app.schemas.chocolate import CheckoutIn, CheckoutOut

router = APIRouter()


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    body: CheckoutIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CheckoutOut:
    name = body.customer_name.strip()
    if not name:
        raise HTTPException(
            status_code=400, detail="customer_name must not be empty or whitespace"
        )

    total = 0
    lines_out: list[dict] = []

    for line in body.items:
        ch = await db["chocolates"].find_one({"id": str(line.chocolate_id)})
        if ch is None:
            raise HTTPException(
                status_code=400, detail=f"Unknown chocolate {line.chocolate_id}"
            )
        if not ch.get("in_stock", True):
            raise HTTPException(
                status_code=400,
                detail=f"{ch['name']} is out of stock",
            )
        line_total = ch["price_cents"] * line.quantity
        total += line_total
        lines_out.append(
            {
                "chocolate_id": ch["id"],
                "quantity": line.quantity,
                "unit_price_cents": ch["price_cents"],
            }
        )

    order_id = uuid.uuid4()
    await db["orders"].insert_one(
        {
            "id": str(order_id),
            "customer_name": name,
            "customer_email": str(body.customer_email).lower(),
            "total_cents": total,
            "status": "paid",
            "created_at": datetime.now(timezone.utc),
            "items": lines_out,
        }
    )

    return CheckoutOut(order_id=order_id, total_cents=total)
