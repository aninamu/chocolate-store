from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.db import get_db
from app.cache import cache_get, cache_set
from app.models.chocolate import ChocolateDoc
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


def _mongo_sort(sort_key: str) -> list[tuple[str, int]]:
    if sort_key == "price_asc":
        return [("price_cents", 1), ("name", 1)]
    if sort_key == "price_desc":
        return [("price_cents", -1), ("name", 1)]
    if sort_key == "cacao_desc":
        return [("cacao_percentage", -1), ("name", 1)]
    return [("name", 1)]


def _doc_to_out(doc: dict) -> ChocolateOut:
    return ChocolateOut.model_validate(ChocolateDoc.from_mongo(doc))


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
    query: dict = {}
    if cleaned:
        query["tags"] = {"$in": cleaned}

    cursor = db.chocolates.find(query).sort(_mongo_sort(_normalize_sort_key(sort)))
    rows = await cursor.to_list(length=None)
    out = [_doc_to_out(row) for row in rows]
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

    row = await db.chocolates.find_one({"id": str(chocolate_id)})
    if row is None:
        raise HTTPException(status_code=404, detail="Chocolate not found")
    out = _doc_to_out(row)
    await cache_set(
        key, json.dumps(out.model_dump(mode="json")), settings.cache_ttl_seconds
    )
    return out
