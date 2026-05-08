from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.cache import cache_get, cache_set
from app.config import settings
from app.db import get_db
from app.schemas.chocolate import ChocolateOut

log = logging.getLogger(__name__)

router = APIRouter()


def _normalize_sort_key(sort: str | None) -> str:
    s = sort or "name"
    if s in ("price_asc", "price_desc", "cacao_desc", "name"):
        return s
    return "name"


def _list_cache_key(tag: list[str] | None, sort: str | None) -> str:
    t = tag or []
    tkey = ",".join(sorted(x.strip() for x in t if x and x.strip()))
    return f"chocolates:list:{tkey}:{_normalize_sort_key(sort)}"


def _detail_cache_key(cid: UUID) -> str:
    return f"chocolates:id:{cid}"


@router.get("", response_model=list[ChocolateOut])
async def list_chocolates(
    tag: list[str] = Query(
        default_factory=list,
        description="Repeat `tag=`; OR semantics: chocolate must include at least one listed tag.",
    ),
    sort: str | None = Query(
        "name",
        description="name | price_asc | price_desc | cacao_desc",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ChocolateOut]:
    key = _list_cache_key(tag, sort)
    raw = await cache_get(key)
    if raw:
        try:
            data = json.loads(raw)
            return [ChocolateOut.model_validate(x) for x in data]
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("cache miss parse %s: %s", key, e)

    cleaned = [t.strip() for t in (tag or []) if t and t.strip()]
    filt: dict = {}
    if cleaned:
        filt["tags"] = {"$in": cleaned}

    s = _normalize_sort_key(sort)
    cursor = db["chocolates"].find(filt)

    if s == "cacao_desc":
        rows = await cursor.to_list(10_000)
        rows.sort(
            key=lambda r: (
                r.get("cacao_percentage") is None,
                -(r["cacao_percentage"] if r.get("cacao_percentage") is not None else 0),
                r["name"],
            )
        )
    elif s == "price_asc":
        rows = await cursor.sort([("price_cents", 1), ("name", 1)]).to_list(10_000)
    elif s == "price_desc":
        rows = await cursor.sort([("price_cents", -1), ("name", 1)]).to_list(10_000)
    else:
        rows = await cursor.sort([("name", 1)]).to_list(10_000)

    out = [ChocolateOut.model_validate(r) for r in rows]
    await cache_set(
        key,
        json.dumps([m.model_dump(mode="json") for m in out]),
        settings.cache_ttl_seconds,
    )
    return out


@router.get("/{chocolate_id}", response_model=ChocolateOut)
async def get_chocolate(
    chocolate_id: UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ChocolateOut:
    key = _detail_cache_key(chocolate_id)
    raw = await cache_get(key)
    if raw:
        try:
            return ChocolateOut.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("detail cache miss %s: %s", key, e)

    row = await db["chocolates"].find_one({"id": str(chocolate_id)})
    if row is None:
        raise HTTPException(status_code=404, detail="Chocolate not found")
    out = ChocolateOut.model_validate(row)
    await cache_set(
        key, json.dumps(out.model_dump(mode="json")), settings.cache_ttl_seconds
    )
    return out
