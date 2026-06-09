from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, String, asc, desc, literal, select
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
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


def _list_cache_key(
    tag: list[str] | None, sort: str | None, available: bool | None = None
) -> str:
    t = tag or []
    tkey = ",".join(sorted(x.strip() for x in t if x and x.strip()))
    avail = "1" if available else "0"
    return f"chocolates:list:{tkey}:{_normalize_sort_key(sort)}:{avail}"


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
    available: bool | None = Query(
        None,
        description="If true, only in-stock chocolates",
    ),
    session: AsyncSession = Depends(get_db),
) -> list[ChocolateOut]:
    key = _list_cache_key(tag, sort, available)
    raw = await cache_get(key)
    if raw:
        try:
            data = json.loads(raw)
            return [ChocolateOut.model_validate(x) for x in data]
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("cache miss parse %s: %s", key, e)

    cleaned = [t.strip() for t in (tag or []) if t and t.strip()]
    stmt: Select[tuple[Chocolate]] = select(Chocolate)
    if cleaned:
        literals = [literal(s, type_=String(64)) for s in cleaned]
        any_of = array(literals)
        stmt = stmt.where(Chocolate.tags.op("&&")(any_of))
    if available:
        stmt = stmt.where(Chocolate.in_stock)
    s = _normalize_sort_key(sort)
    if s == "price_asc":
        stmt = stmt.order_by(asc(Chocolate.price_cents), asc(Chocolate.name))
    elif s == "price_desc":
        stmt = stmt.order_by(desc(Chocolate.price_cents), asc(Chocolate.name))
    elif s == "cacao_desc":
        stmt = stmt.order_by(
            desc(Chocolate.cacao_percentage).nulls_last(), asc(Chocolate.name)
        )
    else:
        stmt = stmt.order_by(asc(Chocolate.name))

    result = await session.execute(stmt)
    rows = result.scalars().all()
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
    session: AsyncSession = Depends(get_db),
) -> ChocolateOut:
    key = _detail_cache_key(chocolate_id)
    raw = await cache_get(key)
    if raw:
        try:
            return ChocolateOut.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValueError) as e:
            log.debug("detail cache miss %s: %s", key, e)

    result = await session.execute(select(Chocolate).where(Chocolate.id == chocolate_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Chocolate not found")
    out = ChocolateOut.model_validate(row)
    await cache_set(
        key, json.dumps(out.model_dump(mode="json")), settings.cache_ttl_seconds
    )
    return out
