from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.cache import cache_get, cache_set
from app.models.chocolate import Chocolate
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


def _sort_chocolates(rows: list[Chocolate], sort_key: str) -> list[Chocolate]:
    if sort_key == "price_asc":
        return sorted(rows, key=lambda c: (c.price_cents, c.name))
    if sort_key == "price_desc":
        return sorted(rows, key=lambda c: (-c.price_cents, c.name))
    if sort_key == "cacao_desc":
        return sorted(
            rows,
            key=lambda c: (
                c.cacao_percentage is None,
                -(c.cacao_percentage or 0),
                c.name,
            ),
        )
    return sorted(rows, key=lambda c: c.name)


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
    if cleaned:
        rows = await Chocolate.find({"tags": {"$in": cleaned}}).to_list()
    else:
        rows = await Chocolate.find_all().to_list()

    sort_key = _normalize_sort_key(sort)
    rows = _sort_chocolates(rows, sort_key)
    out = [ChocolateOut.model_validate(r) for r in rows]
    await cache_set(
        key,
        json.dumps([m.model_dump(mode="json") for m in out]),
        settings.cache_ttl_seconds,
    )
    return out


@router.get("/{chocolate_id}", response_model=ChocolateOut)
async def get_chocolate(chocolate_id: UUID) -> ChocolateOut:
    key = _detail_cache_key(chocolate_id)
    raw = await cache_get(key)
    if raw:
        try:
            return ChocolateOut.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("detail cache miss %s: %s", key, e)

    row = await Chocolate.get(chocolate_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Chocolate not found")
    out = ChocolateOut.model_validate(row)
    await cache_set(
        key, json.dumps(out.model_dump(mode="json")), settings.cache_ttl_seconds
    )
    return out
