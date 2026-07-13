"""Create Mongo indexes via Beanie and insert all seed chocolates.

Invoked by scripts/services-up.sh against a freshly-created (empty) database.
"""
from __future__ import annotations

import asyncio
import logging

from app.config import settings
from app.documents.chocolate import ChocolateDocument
from app.mongo import close_mongo, init_mongo
from app.seed import SEED, slugify

log = logging.getLogger(__name__)


async def _run() -> None:
    if not settings.mongodb_enabled:
        raise SystemExit("MONGODB_ENABLED is false; refusing to init Mongo")

    await init_mongo()

    existing = await ChocolateDocument.count()
    if existing:
        print(f"init_mongo: chocolates already has {existing} docs; skipping seed")
        await close_mongo()
        return

    docs = [
        ChocolateDocument(
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
        for row in SEED
    ]
    await ChocolateDocument.insert_many(docs)
    await close_mongo()
    print(f"init_mongo: created indexes and inserted {len(SEED)} chocolates")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_run())


if __name__ == "__main__":
    main()
