from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import get_client
from app.models.chocolate import Chocolate, Order, OrderItem
from app.schemas.chocolate import CheckoutIn, CheckoutOut

router = APIRouter()


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(body: CheckoutIn) -> CheckoutOut:
    name = body.customer_name.strip()
    if not name:
        raise HTTPException(
            status_code=400, detail="customer_name must not be empty or whitespace"
        )

    client = get_client()
    total = 0
    order = Order(
        customer_name=name,
        customer_email=str(body.customer_email).lower(),
        total_cents=0,
        status="paid",
    )

    async with await client.start_session() as session:
        async with session.start_transaction():
            await order.insert(session=session)

            for line in body.items:
                ch = await Chocolate.get(line.chocolate_id, session=session)
                if ch is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unknown chocolate {line.chocolate_id}",
                    )
                if not ch.in_stock:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{ch.name} is out of stock",
                    )
                line_total = ch.price_cents * line.quantity
                total += line_total
                item = OrderItem(
                    order_id=order.id,
                    chocolate_id=ch.id,
                    quantity=line.quantity,
                    unit_price_cents=ch.price_cents,
                )
                await item.insert(session=session)

            order.total_cents = total
            await order.save(session=session)

    return CheckoutOut(order_id=order.id, total_cents=total)
