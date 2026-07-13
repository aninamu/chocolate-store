"""One-off ETL: copy Postgres chocolates + orders into MongoDB.

Usage (from backend/ with venv active and both stores up):
  python -m scripts.backfill_mongo
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import AsyncSessionFactory, dispose_engine, postgres_available
from app.documents.chocolate import (
    ChocolateDocument,
    OrderDocument,
    OrderItemEmbedded,
    ProductSnapshot,
)
from app.models.chocolate import Chocolate, Order
from app.mongo import close_mongo, init_mongo

log = logging.getLogger(__name__)


async def backfill_chocolates(session) -> int:
    result = await session.execute(select(Chocolate).order_by(Chocolate.created_at))
    rows = result.scalars().all()
    for row in rows:
        existing = await ChocolateDocument.get(row.id)
        payload = dict(
            name=row.name,
            slug=row.slug,
            description=row.description,
            origin=row.origin,
            cacao_percentage=row.cacao_percentage,
            price_cents=row.price_cents,
            image_url=row.image_url,
            churrito_quote=row.churrito_quote,
            tags=list(row.tags or []),
            in_stock=row.in_stock,
            created_at=row.created_at,
        )
        if existing is None:
            await ChocolateDocument(id=row.id, **payload).insert()
        else:
            for k, v in payload.items():
                setattr(existing, k, v)
            await existing.save()
    return len(rows)


async def backfill_orders(session) -> int:
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at)
    )
    orders = result.scalars().all()
    chocolate_names: dict = {}
    chocs = await session.execute(select(Chocolate))
    for ch in chocs.scalars().all():
        chocolate_names[ch.id] = (ch.name, ch.slug)

    for order in orders:
        items = []
        for item in order.items:
            snap = None
            if item.chocolate_id in chocolate_names:
                name, slug = chocolate_names[item.chocolate_id]
                snap = ProductSnapshot(name=name, slug=slug)
            items.append(
                OrderItemEmbedded(
                    chocolate_id=item.chocolate_id,
                    quantity=item.quantity,
                    unit_price_cents=item.unit_price_cents,
                    product_snapshot=snap,
                )
            )
        existing = await OrderDocument.get(order.id)
        payload = dict(
            customer_name=order.customer_name,
            customer_email=order.customer_email.lower(),
            total_cents=order.total_cents,
            status=order.status,
            created_at=order.created_at,
            items=items,
        )
        if existing is None:
            await OrderDocument(id=order.id, **payload).insert()
        else:
            for k, v in payload.items():
                setattr(existing, k, v)
            await existing.save()
    return len(orders)


async def verify_fk() -> list[str]:
    orphans: list[str] = []
    chocolate_ids = {
        str(d.id) for d in await ChocolateDocument.find_all().to_list()
    }
    for order in await OrderDocument.find_all().to_list():
        for item in order.items:
            cid = str(item.chocolate_id)
            if cid not in chocolate_ids:
                orphans.append(f"order={order.id} chocolate_id={cid}")
    return orphans


async def _run() -> None:
    logging.basicConfig(level=logging.INFO)
    if not settings.mongodb_enabled:
        raise SystemExit("MONGODB_ENABLED is false")
    if not postgres_available() or AsyncSessionFactory is None:
        raise SystemExit("DATABASE_URL required for backfill")

    await init_mongo()
    # One-off ETL: replace Mongo collections so UUIDs match Postgres.
    deleted_ch = await ChocolateDocument.delete_all()
    deleted_ord = await OrderDocument.delete_all()
    log.info("cleared mongo chocolates=%s orders=%s", deleted_ch, deleted_ord)

    async with AsyncSessionFactory() as session:
        n_ch = await backfill_chocolates(session)
        n_ord = await backfill_orders(session)
    orphans = await verify_fk()
    await close_mongo()
    await dispose_engine()
    print(f"backfill_mongo: chocolates={n_ch} orders={n_ord}")
    if orphans:
        print(f"backfill_mongo: WARNING {len(orphans)} orphan item refs:")
        for o in orphans[:20]:
            print(f"  {o}")
        raise SystemExit(1)
    print("backfill_mongo: ok")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
