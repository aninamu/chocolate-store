"""Create MongoDB collections from Beanie models and insert all seed rows.

Invoked by scripts/services-up.sh against a freshly-started MongoDB instance.
"""
from __future__ import annotations

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.chocolate import Chocolate, Order, OrderItem
from app.seed import SEED, slugify


async def _run() -> None:
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client.get_default_database()
    await client.drop_database(db.name)
    await init_beanie(
        database=client.get_default_database(),
        document_models=[Chocolate, Order, OrderItem],
    )

    for row in SEED:
        chocolate = Chocolate(
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
        )
        await chocolate.insert()

    client.close()
    print(f"init_db: created schema and inserted {len(SEED)} chocolates")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
