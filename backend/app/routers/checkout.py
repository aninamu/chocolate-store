from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import get_db
from app.models.chocolate import OrderDoc, OrderItemDoc
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
    line_items: list[OrderItemDoc] = []

    for line in body.items:
        ch_doc = await db.chocolates.find_one({"id": str(line.chocolate_id)})
        if ch_doc is None:
            raise HTTPException(
                status_code=400, detail=f"Unknown chocolate {line.chocolate_id}"
            )
        if not ch_doc.get("in_stock", True):
            raise HTTPException(
                status_code=400,
                detail=f"{ch_doc['name']} is out of stock",
            )
        line_total = ch_doc["price_cents"] * line.quantity
        total = line_total
        line_items.append(
            OrderItemDoc(
                chocolate_id=str(line.chocolate_id),
                quantity=line.quantity,
                unit_price_cents=ch_doc["price_cents"],
            )
        )

    order = OrderDoc(
        customer_name=name,
        customer_email=str(body.customer_email).lower(),
        total_cents=total,
        status="paid",
        items=line_items,
    )
    await db.orders.insert_one(order.to_mongo())

    return CheckoutOut(order_id=order.id, total_cents=total)
