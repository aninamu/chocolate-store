"""Reconcile Postgres vs MongoDB for chocolates and orders.

Exit codes:
  0 — clean
  1 — drift detected
  2 — connectivity / config failure

Usage:
  python -m scripts.reconcile --domain chocolates --mode full
  python -m scripts.reconcile --domain orders --mode sample --rate 0.05
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import AsyncSessionFactory, dispose_engine, postgres_available
from app.documents.chocolate import ChocolateDocument, OrderDocument
from app.models.chocolate import Chocolate, Order
from app.mongo import close_mongo, init_mongo

log = logging.getLogger(__name__)


def _canon_dt(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return int(value.timestamp())
    return None


def chocolate_checksum(doc: dict[str, Any]) -> str:
    canonical = {
        "id": str(doc["id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "description": doc["description"],
        "origin": doc.get("origin"),
        "cacao_percentage": doc.get("cacao_percentage"),
        "price_cents": doc["price_cents"],
        "image_url": doc["image_url"],
        "churrito_quote": doc.get("churrito_quote"),
        "tags": sorted(doc.get("tags") or []),
        "in_stock": doc["in_stock"],
        "created_at": _canon_dt(doc.get("created_at")),
    }
    return hashlib.sha256(
        json.dumps(canonical, sort_keys=True, default=str).encode()
    ).hexdigest()


def order_checksum(doc: dict[str, Any]) -> str:
    items = sorted(
        [
            {
                "chocolate_id": str(i["chocolate_id"]),
                "quantity": i["quantity"],
                "unit_price_cents": i["unit_price_cents"],
            }
            for i in (doc.get("items") or [])
        ],
        key=lambda x: (x["chocolate_id"], x["quantity"]),
    )
    canonical = {
        "id": str(doc["id"]),
        "customer_name": doc["customer_name"],
        "customer_email": doc["customer_email"].lower(),
        "total_cents": doc["total_cents"],
        "status": doc["status"],
        "created_at": _canon_dt(doc.get("created_at")),
        "items": items,
    }
    return hashlib.sha256(
        json.dumps(canonical, sort_keys=True, default=str).encode()
    ).hexdigest()


def _pg_chocolate_dict(row: Chocolate) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "slug": row.slug,
        "description": row.description,
        "origin": row.origin,
        "cacao_percentage": row.cacao_percentage,
        "price_cents": row.price_cents,
        "image_url": row.image_url,
        "churrito_quote": row.churrito_quote,
        "tags": list(row.tags or []),
        "in_stock": row.in_stock,
        "created_at": row.created_at,
    }


def _mongo_chocolate_dict(doc: ChocolateDocument) -> dict[str, Any]:
    return {
        "id": doc.id,
        "name": doc.name,
        "slug": doc.slug,
        "description": doc.description,
        "origin": doc.origin,
        "cacao_percentage": doc.cacao_percentage,
        "price_cents": doc.price_cents,
        "image_url": doc.image_url,
        "churrito_quote": doc.churrito_quote,
        "tags": list(doc.tags or []),
        "in_stock": doc.in_stock,
        "created_at": doc.created_at,
    }


def _pg_order_dict(row: Order) -> dict[str, Any]:
    return {
        "id": row.id,
        "customer_name": row.customer_name,
        "customer_email": row.customer_email,
        "total_cents": row.total_cents,
        "status": row.status,
        "created_at": row.created_at,
        "items": [
            {
                "chocolate_id": i.chocolate_id,
                "quantity": i.quantity,
                "unit_price_cents": i.unit_price_cents,
            }
            for i in row.items
        ],
    }


def _mongo_order_dict(doc: OrderDocument) -> dict[str, Any]:
    return {
        "id": doc.id,
        "customer_name": doc.customer_name,
        "customer_email": doc.customer_email,
        "total_cents": doc.total_cents,
        "status": doc.status,
        "created_at": doc.created_at,
        "items": [
            {
                "chocolate_id": i.chocolate_id,
                "quantity": i.quantity,
                "unit_price_cents": i.unit_price_cents,
            }
            for i in doc.items
        ],
    }


async def reconcile_chocolates(*, mode: str, rate: float) -> int:
    assert AsyncSessionFactory is not None
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(Chocolate))
        pg_map = {str(r.id): _pg_chocolate_dict(r) for r in result.scalars().all()}

    mongo_docs = await ChocolateDocument.find_all().to_list()
    mongo_map = {str(d.id): _mongo_chocolate_dict(d) for d in mongo_docs}

    pg_ids = set(pg_map)
    mongo_ids = set(mongo_map)
    only_pg = pg_ids - mongo_ids
    only_mongo = mongo_ids - pg_ids
    shared = sorted(pg_ids & mongo_ids)

    if mode == "sample" and shared:
        k = max(1, int(len(shared) * rate))
        shared = sorted(random.sample(shared, min(k, len(shared))))

    mismatches = []
    for cid in shared:
        if chocolate_checksum(pg_map[cid]) != chocolate_checksum(mongo_map[cid]):
            mismatches.append(cid)

    print(
        f"chocolates: pg={len(pg_ids)} mongo={len(mongo_ids)} "
        f"only_pg={len(only_pg)} only_mongo={len(only_mongo)} "
        f"checksum_mismatches={len(mismatches)}"
    )
    if only_pg or only_mongo or mismatches:
        for cid in list(only_pg)[:10]:
            print(f"  only_pg {cid}")
        for cid in list(only_mongo)[:10]:
            print(f"  only_mongo {cid}")
        for cid in mismatches[:10]:
            print(f"  mismatch {cid}")
        return 1
    return 0


async def reconcile_orders(*, mode: str, rate: float) -> int:
    assert AsyncSessionFactory is not None
    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(Order).options(selectinload(Order.items))
        )
        pg_map = {str(r.id): _pg_order_dict(r) for r in result.scalars().all()}

    mongo_docs = await OrderDocument.find_all().to_list()
    mongo_map = {str(d.id): _mongo_order_dict(d) for d in mongo_docs}

    pg_ids = set(pg_map)
    mongo_ids = set(mongo_map)
    only_pg = pg_ids - mongo_ids
    only_mongo = mongo_ids - pg_ids
    shared = sorted(pg_ids & mongo_ids)

    if mode == "sample" and shared:
        k = max(1, int(len(shared) * rate))
        shared = sorted(random.sample(shared, min(k, len(shared))))

    mismatches = []
    for oid in shared:
        if order_checksum(pg_map[oid]) != order_checksum(mongo_map[oid]):
            mismatches.append(oid)

    print(
        f"orders: pg={len(pg_ids)} mongo={len(mongo_ids)} "
        f"only_pg={len(only_pg)} only_mongo={len(only_mongo)} "
        f"checksum_mismatches={len(mismatches)}"
    )
    if only_pg or only_mongo or mismatches:
        for oid in list(only_pg)[:10]:
            print(f"  only_pg {oid}")
        for oid in list(only_mongo)[:10]:
            print(f"  only_mongo {oid}")
        for oid in mismatches[:10]:
            print(f"  mismatch {oid}")
        return 1
    return 0


async def _run(args: argparse.Namespace) -> int:
    logging.basicConfig(level=logging.INFO)
    if not settings.mongodb_enabled:
        print("MONGODB_ENABLED is false", file=sys.stderr)
        return 2
    if not postgres_available() or AsyncSessionFactory is None:
        print("DATABASE_URL required for reconcile", file=sys.stderr)
        return 2

    await init_mongo()
    try:
        if args.domain == "chocolates":
            return await reconcile_chocolates(mode=args.mode, rate=args.rate)
        if args.domain == "orders":
            return await reconcile_orders(mode=args.mode, rate=args.rate)
        # both
        rc = await reconcile_chocolates(mode=args.mode, rate=args.rate)
        rc2 = await reconcile_orders(mode=args.mode, rate=args.rate)
        return 1 if (rc or rc2) else 0
    finally:
        await close_mongo()
        await dispose_engine()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconcile Postgres vs MongoDB")
    parser.add_argument(
        "--domain",
        choices=["chocolates", "orders", "all"],
        default="all",
    )
    parser.add_argument("--mode", choices=["full", "sample"], default="full")
    parser.add_argument("--rate", type=float, default=0.05, help="sample rate")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
