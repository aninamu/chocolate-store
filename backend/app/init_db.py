"""Create MongoDB collections and insert all seed rows.

Invoked by scripts/services-up.sh against a freshly-started MongoDB instance.
"""
from __future__ import annotations

import asyncio

from app.db import close_db, get_database
from app.models.chocolate import ChocolateDoc
from app.seed import SEED, slugify


async def _run() -> None:
    db = get_database()
    await db.chocolates.delete_many({})
    await db.orders.delete_many({})

    for row in SEED:
        doc = ChocolateDoc(
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
        await db.chocolates.insert_one(doc.to_mongo())

    await close_db()
    print(f"init_db: inserted {len(SEED)} chocolates into MongoDB")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
