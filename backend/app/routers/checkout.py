from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.repositories.chocolates import ChocolateRepository
from app.repositories.factory import get_chocolate_repo, get_order_repo
from app.repositories.orders import OrderRepository
from app.schemas.chocolate import CheckoutIn, CheckoutOut

router = APIRouter()


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    body: CheckoutIn,
    order_repo: OrderRepository = Depends(get_order_repo),
    chocolate_repo: ChocolateRepository = Depends(get_chocolate_repo),
) -> CheckoutOut:
    name = body.customer_name.strip()
    if not name:
        raise HTTPException(
            status_code=400, detail="customer_name must not be empty or whitespace"
        )
    return await order_repo.create_checkout(
        customer_name=name,
        customer_email=str(body.customer_email),
        items=body.items,
        chocolate_repo=chocolate_repo,
    )
