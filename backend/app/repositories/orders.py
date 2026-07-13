from __future__ import annotations

import logging
import uuid
from typing import Optional, Protocol

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.documents.chocolate import (
    ChocolateDocument,
    OrderDocument,
    OrderItemEmbedded,
    ProductSnapshot,
)
from app.models.chocolate import Chocolate, Order, OrderItem
from app.repositories.chocolates import ChocolateRepository
from app.schemas.chocolate import CartLineIn, CheckoutOut

log = logging.getLogger(__name__)


class OrderRepository(Protocol):
    async def create_checkout(
        self,
        *,
        customer_name: str,
        customer_email: str,
        items: list[CartLineIn],
        chocolate_repo: ChocolateRepository,
        order_id: uuid.UUID | None = None,
    ) -> CheckoutOut: ...


class PostgresOrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_checkout(
        self,
        *,
        customer_name: str,
        customer_email: str,
        items: list[CartLineIn],
        chocolate_repo: ChocolateRepository,
        order_id: uuid.UUID | None = None,
    ) -> CheckoutOut:
        async with self._session.begin():
            total = 0
            order = Order(
                id=order_id or uuid.uuid4(),
                customer_name=customer_name,
                customer_email=customer_email.lower(),
                total_cents=0,
                status="paid",
            )
            self._session.add(order)
            await self._session.flush()

            for line in items:
                res = await self._session.execute(
                    select(Chocolate).where(Chocolate.id == line.chocolate_id)
                )
                ch = res.scalar_one_or_none()
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
                self._session.add(
                    OrderItem(
                        order_id=order.id,
                        chocolate_id=ch.id,
                        quantity=line.quantity,
                        unit_price_cents=ch.price_cents,
                    )
                )

            order.total_cents = total

        return CheckoutOut(order_id=order.id, total_cents=total)


class MongoOrderRepository:
    async def create_checkout(
        self,
        *,
        customer_name: str,
        customer_email: str,
        items: list[CartLineIn],
        chocolate_repo: ChocolateRepository,
        order_id: uuid.UUID | None = None,
    ) -> CheckoutOut:
        oid = order_id or uuid.uuid4()
        # Idempotent upsert for dual-write retries.
        existing = await OrderDocument.get(oid)
        if existing is not None:
            return CheckoutOut(order_id=existing.id, total_cents=existing.total_cents)

        total = 0
        embedded: list[OrderItemEmbedded] = []
        for line in items:
            ch = await chocolate_repo.get_by_id(line.chocolate_id)
            if ch is None:
                # Fall back to direct Mongo lookup if repo is Postgres-backed.
                doc = await ChocolateDocument.get(line.chocolate_id)
                if doc is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unknown chocolate {line.chocolate_id}",
                    )
                ch_name = doc.name
                ch_slug = doc.slug
                ch_price = doc.price_cents
                ch_in_stock = doc.in_stock
            else:
                ch_name = ch.name
                ch_slug = ch.slug
                ch_price = ch.price_cents
                ch_in_stock = ch.in_stock

            if not ch_in_stock:
                raise HTTPException(
                    status_code=400,
                    detail=f"{ch_name} is out of stock",
                )
            total += ch_price * line.quantity
            embedded.append(
                OrderItemEmbedded(
                    chocolate_id=line.chocolate_id,
                    quantity=line.quantity,
                    unit_price_cents=ch_price,
                    product_snapshot=ProductSnapshot(name=ch_name, slug=ch_slug),
                )
            )

        order = OrderDocument(
            id=oid,
            customer_name=customer_name,
            customer_email=customer_email.lower(),
            total_cents=total,
            status="paid",
            items=embedded,
        )
        await order.insert()
        return CheckoutOut(order_id=order.id, total_cents=total)


class DualWriteOrderRepository:
    def __init__(
        self,
        primary: OrderRepository,
        secondary: OrderRepository,
        *,
        strict: bool,
    ) -> None:
        self._primary = primary
        self._secondary = secondary
        self._strict = strict

    async def create_checkout(
        self,
        *,
        customer_name: str,
        customer_email: str,
        items: list[CartLineIn],
        chocolate_repo: ChocolateRepository,
        order_id: uuid.UUID | None = None,
    ) -> CheckoutOut:
        oid = order_id or uuid.uuid4()
        result = await self._primary.create_checkout(
            customer_name=customer_name,
            customer_email=customer_email,
            items=items,
            chocolate_repo=chocolate_repo,
            order_id=oid,
        )
        try:
            await self._secondary.create_checkout(
                customer_name=customer_name,
                customer_email=customer_email,
                items=items,
                chocolate_repo=chocolate_repo,
                order_id=result.order_id,
            )
        except Exception:
            if self._strict:
                raise
            log.exception(
                "dual-write order secondary failed order_id=%s", result.order_id
            )
        return result


def build_order_repository(
    session: Optional[AsyncSession] = None,
) -> OrderRepository:
    mode = settings.db_write_mode_orders
    mongo_repo = MongoOrderRepository()
    pg_repo: Optional[PostgresOrderRepository] = None
    if session is not None:
        pg_repo = PostgresOrderRepository(session)

    if mode == "mongo":
        return mongo_repo
    if mode == "postgres":
        if pg_repo is None:
            raise RuntimeError("postgres order writes require Postgres session")
        return pg_repo
    if mode == "dual":
        if pg_repo is None:
            raise RuntimeError("dual order writes require Postgres session")
        if settings.dual_write_orders_primary == "mongo":
            return DualWriteOrderRepository(
                mongo_repo, pg_repo, strict=settings.dual_write_strict
            )
        return DualWriteOrderRepository(
            pg_repo, mongo_repo, strict=settings.dual_write_strict
        )
    raise ValueError(f"Unknown DB_WRITE_MODE_ORDERS={mode!r}")
