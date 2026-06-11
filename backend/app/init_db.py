"""Connect to MongoDB and insert all seed rows.

Invoked by scripts/services-up.sh against a freshly-created (empty) database.
"""
from __future__ import annotations

import asyncio

from app.db import close_mongodb, init_mongodb
from app.models.chocolate import Chocolate, Order
from app.seed import SEED, slugify


async def _run() -> None:
    await init_mongodb()
    try:
        await Chocolate.delete_all()
        await Order.delete_all()
        for row in SEED:
            await Chocolate(
                name=row["name"],
                slug=slugify(row["name"]),
                description=row["description"],
                origin=row.get("origin"),
                cacao_percentage=row.get("cacao_percentage"),
                price_cents=row["price_cents"],
                image_url=row["image_url"],
                churrito_quote=row.get("churrito_quote"),
                tags=row["tags"],
                in_stock=True,
            ).insert()
        print(f"init_db: inserted {len(SEED)} chocolates")
    finally:
        await close_mongodb()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
