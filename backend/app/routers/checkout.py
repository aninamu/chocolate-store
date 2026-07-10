from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.chocolate import Chocolate, Order, OrderItem
from app.schemas.chocolate import CheckoutIn, CheckoutOut

router = APIRouter()


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    body: CheckoutIn,
    session: AsyncSession = Depends(get_db),
) -> CheckoutOut:
    name = body.customer_name.strip()
    if not name:
        raise HTTPException(
            status_code=400, detail="customer_name must not be empty or whitespace"
        )
    async with session.begin():
        total = 0
        order = Order(
            customer_name=name,
            customer_email=str(body.customer_email).lower(),
            total_cents=0,
            status="paid",
        )
        session.add(order)
        await session.flush()

        ids = [line.chocolate_id for line in body.items]
        res = await session.execute(
            select(Chocolate).where(Chocolate.id.in_(ids))
        )
        by_id = {ch.id: ch for ch in res.scalars().all()}

        for line in body.items:
            ch = by_id.get(line.chocolate_id)
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
            session.add(
                OrderItem(
                    order_id=order.id,
                    chocolate_id=ch.id,
                    quantity=line.quantity,
                    unit_price_cents=ch.price_cents,
                )
            )

        order.total_cents = total

    return CheckoutOut(order_id=order.id, total_cents=total)
