from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.cache import cache_get, cache_set
from app.repositories.chocolates import ChocolateRepository, normalize_sort_key
from app.repositories.factory import get_chocolate_repo
from app.schemas.chocolate import ChocolateOut

log = logging.getLogger(__name__)

router = APIRouter()


def _cache_source_prefix() -> str:
    """Namespace Redis keys by read source so flips do not serve stale data."""
    return settings.db_read_source_chocolates


def _list_cache_key(tag: list[str] | None, sort: str | None) -> str:
    t = tag or []
    tkey = ",".join(sorted(x.strip() for x in t if x and x.strip()))
    return (
        f"chocolates:{_cache_source_prefix()}:list:{tkey}:{normalize_sort_key(sort)}"
    )


def _detail_cache_key(cid: UUID) -> str:
    return f"chocolates:{_cache_source_prefix()}:id:{cid}"


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
    repo: ChocolateRepository = Depends(get_chocolate_repo),
) -> list[ChocolateOut]:
    key = _list_cache_key(tag, sort)
    raw = await cache_get(key)
    if raw:
        try:
            data = json.loads(raw)
            return [ChocolateOut.model_validate(x) for x in data]
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("cache miss parse %s: %s", key, e)

    out = await repo.list(tags=tag, sort=sort)
    await cache_set(
        key,
        json.dumps([m.model_dump(mode="json") for m in out]),
        settings.cache_ttl_seconds,
    )
    return out


@router.get("/{chocolate_id}", response_model=ChocolateOut)
async def get_chocolate(
    chocolate_id: UUID,
    repo: ChocolateRepository = Depends(get_chocolate_repo),
) -> ChocolateOut:
    key = _detail_cache_key(chocolate_id)
    raw = await cache_get(key)
    if raw:
        try:
            return ChocolateOut.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("detail cache miss %s: %s", key, e)

    row = await repo.get_by_id(chocolate_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Chocolate not found")
    await cache_set(
        key, json.dumps(row.model_dump(mode="json")), settings.cache_ttl_seconds
    )
    return row
