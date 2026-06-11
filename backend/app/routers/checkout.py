from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.chocolate import Chocolate, Order, OrderLine
from app.schemas.chocolate import CheckoutIn, CheckoutOut

router = APIRouter()


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(body: CheckoutIn) -> CheckoutOut:
    name = body.customer_name.strip()
    if not name:
        raise HTTPException(
            status_code=400, detail="customer_name must not be empty or whitespace"
        )

    total = 0
    lines: list[OrderLine] = []

    for line in body.items:
        ch = await Chocolate.get(line.chocolate_id)
        if ch is None:
            raise HTTPException(
                status_code=400, detail=f"Unknown chocolate {line.chocolate_id}"
            )
        if not ch.in_stock:
            raise HTTPException(
                status_code=400,
                detail=f"{ch.name} is out of stock",
            )
        line_total = ch.price_cents * line.quantity
        total += line_total
        lines.append(
            OrderLine(
                chocolate_id=ch.id,
                quantity=line.quantity,
                unit_price_cents=ch.price_cents,
            )
        )

    order = Order(
        customer_name=name,
        customer_email=str(body.customer_email).lower(),
        total_cents=total,
        status="paid",
        items=lines,
    )
    await order.insert()

    return CheckoutOut(order_id=order.id, total_cents=total)
