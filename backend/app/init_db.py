"""Create the schema from SQLAlchemy models and insert all seed rows.

Invoked by scripts/services-up.sh against a freshly-created (empty) database.
"""
from __future__ import annotations

import asyncio

from app.db import AsyncSessionFactory, engine
from app.models.base import Base
from app.models.chocolate import Chocolate
from app.seed import SEED, slugify


async def _run() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionFactory() as session:
        for row in SEED:
            session.add(
                Chocolate(
                    name=row["name"],
                    slug=slugify(row["name"]),
                    description=row["description"],
                    origin=row.get("origin"),
                    cacao_percentage=row.get("cacao_percentage"),
                    price_cents=row["price_cents"],
                    image_url=row["image_url"],
                    tags=row["tags"],
                    in_stock=True,
                )
            )
        await session.commit()

    await engine.dispose()
    print(f"init_db: created schema and inserted {len(SEED)} chocolates")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
