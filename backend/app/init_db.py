"""Drop the application Mongo database and insert catalog seed rows.

Invoked by scripts/services-up.sh after MongoDB is listening.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

from app.config import settings
from app.seed import SEED, slugify


def main() -> None:
    client = MongoClient(settings.mongodb_url)
    try:
        client.drop_database(settings.mongo_db)
        db = client[settings.mongo_db]
        chocolates = db["chocolates"]
        chocolates.create_index("slug", unique=True)
        chocolates.create_index("id", unique=True)

        now = datetime.now(timezone.utc)
        docs = []
        for row in SEED:
            docs.append(
                {
                    "id": str(uuid.uuid4()),
                    "name": row["name"],
                    "slug": slugify(row["name"]),
                    "description": row["description"],
                    "origin": row.get("origin"),
                    "cacao_percentage": row.get("cacao_percentage"),
                    "price_cents": row["price_cents"],
                    "image_url": row["image_url"],
                    "tags": row["tags"],
                    "in_stock": True,
                    "created_at": now,
                }
            )
        if docs:
            chocolates.insert_many(docs)
        print(f"init_db: dropped '{settings.mongo_db}', seeded {len(docs)} chocolates")
    finally:
        client.close()


if __name__ == "__main__":
    main()
