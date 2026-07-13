from __future__ import annotations

import logging
import uuid
from typing import Optional, Protocol

from sqlalchemy import Select, String, asc, desc, literal, select, update
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.documents.chocolate import ChocolateDocument
from app.models.chocolate import Chocolate
from app.schemas.chocolate import ChocolateOut

log = logging.getLogger(__name__)


def normalize_sort_key(sort: str | None) -> str:
    s = sort or "name"
    if s in ("price_asc", "price_desc", "cacao_desc", "name"):
        return s
    return "name"


def chocolate_to_out(row: Chocolate | ChocolateDocument) -> ChocolateOut:
    return ChocolateOut.model_validate(row)


def _docs_equal(a: ChocolateOut, b: ChocolateOut) -> bool:
    return a.model_dump(mode="json") == b.model_dump(mode="json")


class ChocolateRepository(Protocol):
    async def list(
        self, *, tags: list[str] | None, sort: str | None
    ) -> list[ChocolateOut]: ...

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None: ...

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None: ...


class PostgresChocolateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _apply_sort(self, stmt: Select[tuple[Chocolate]], sort: str | None):
        s = normalize_sort_key(sort)
        if s == "price_asc":
            return stmt.order_by(asc(Chocolate.price_cents), asc(Chocolate.name))
        if s == "price_desc":
            return stmt.order_by(desc(Chocolate.price_cents), asc(Chocolate.name))
        if s == "cacao_desc":
            return stmt.order_by(
                desc(Chocolate.cacao_percentage).nulls_last(), asc(Chocolate.name)
            )
        return stmt.order_by(asc(Chocolate.name))

    async def list(
        self, *, tags: list[str] | None, sort: str | None
    ) -> list[ChocolateOut]:
        cleaned = [t.strip() for t in (tags or []) if t and t.strip()]
        stmt: Select[tuple[Chocolate]] = select(Chocolate)
        if cleaned:
            literals = [literal(s, type_=String(64)) for s in cleaned]
            any_of = array(literals)
            stmt = stmt.where(Chocolate.tags.op("&&")(any_of))
        stmt = self._apply_sort(stmt, sort)
        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [chocolate_to_out(r) for r in rows]

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None:
        result = await self._session.execute(
            select(Chocolate).where(Chocolate.id == chocolate_id)
        )
        row = result.scalar_one_or_none()
        return chocolate_to_out(row) if row else None

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None:
        await self._session.execute(
            update(Chocolate)
            .where(Chocolate.id == chocolate_id)
            .values(in_stock=in_stock)
        )
        await self._session.commit()


class MongoChocolateRepository:
    async def list(
        self, *, tags: list[str] | None, sort: str | None
    ) -> list[ChocolateOut]:
        cleaned = [t.strip() for t in (tags or []) if t and t.strip()]
        query: dict = {}
        if cleaned:
            query["tags"] = {"$in": cleaned}

        s = normalize_sort_key(sort)
        if s == "price_asc":
            sort_spec = [("price_cents", 1), ("name", 1)]
        elif s == "price_desc":
            sort_spec = [("price_cents", -1), ("name", 1)]
        elif s == "cacao_desc":
            # Descending puts nulls last in MongoDB (nulls sort lower than numbers).
            sort_spec = [("cacao_percentage", -1), ("name", 1)]
        else:
            sort_spec = [("name", 1)]

        docs = await ChocolateDocument.find(query).sort(sort_spec).to_list()
        return [chocolate_to_out(d) for d in docs]

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None:
        doc = await ChocolateDocument.get(chocolate_id)
        return chocolate_to_out(doc) if doc else None

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None:
        doc = await ChocolateDocument.get(chocolate_id)
        if doc is None:
            return
        doc.in_stock = in_stock
        await doc.save()


class ShadowChocolateRepository:
    """Serve Postgres results while asynchronously comparing against Mongo."""

    def __init__(
        self, primary: ChocolateRepository, shadow: ChocolateRepository
    ) -> None:
        self._primary = primary
        self._shadow = shadow

    async def list(
        self, *, tags: list[str] | None, sort: str | None
    ) -> list[ChocolateOut]:
        primary_rows = await self._primary.list(tags=tags, sort=sort)
        try:
            shadow_rows = await self._shadow.list(tags=tags, sort=sort)
            if len(primary_rows) != len(shadow_rows) or any(
                not _docs_equal(a, b) for a, b in zip(primary_rows, shadow_rows)
            ):
                log.warning(
                    "shadow catalog list mismatch tags=%s sort=%s pg=%d mongo=%d",
                    tags,
                    sort,
                    len(primary_rows),
                    len(shadow_rows),
                )
        except Exception as e:  # noqa: BLE001
            log.warning("shadow catalog list failed: %s", e)
        return primary_rows

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None:
        primary = await self._primary.get_by_id(chocolate_id)
        try:
            shadow = await self._shadow.get_by_id(chocolate_id)
            if (primary is None) != (shadow is None) or (
                primary is not None
                and shadow is not None
                and not _docs_equal(primary, shadow)
            ):
                log.warning(
                    "shadow catalog detail mismatch id=%s",
                    chocolate_id,
                )
        except Exception as e:  # noqa: BLE001
            log.warning("shadow catalog detail failed: %s", e)
        return primary

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None:
        await self._primary.set_in_stock(chocolate_id, in_stock)
        try:
            await self._shadow.set_in_stock(chocolate_id, in_stock)
        except Exception as e:  # noqa: BLE001
            log.warning("shadow set_in_stock mongo failed: %s", e)


class DualWriteChocolateRepository:
    """Write to both stores (used when dual-writing orders needs stock flips)."""

    def __init__(
        self,
        primary: ChocolateRepository,
        secondary: ChocolateRepository,
        *,
        strict: bool,
    ) -> None:
        self._primary = primary
        self._secondary = secondary
        self._strict = strict

    async def list(
        self, *, tags: list[str] | None, sort: str | None
    ) -> list[ChocolateOut]:
        return await self._primary.list(tags=tags, sort=sort)

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None:
        return await self._primary.get_by_id(chocolate_id)

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None:
        await self._primary.set_in_stock(chocolate_id, in_stock)
        try:
            await self._secondary.set_in_stock(chocolate_id, in_stock)
        except Exception:
            if self._strict:
                raise
            log.exception(
                "dual-write set_in_stock secondary failed id=%s", chocolate_id
            )


def build_chocolate_repository(
    session: Optional[AsyncSession] = None,
) -> ChocolateRepository:
    source = settings.db_read_source_chocolates
    write_mode = settings.db_write_mode_orders
    mongo_repo = MongoChocolateRepository()
    pg_repo: Optional[PostgresChocolateRepository] = None
    if session is not None:
        pg_repo = PostgresChocolateRepository(session)

    # Stock updates during dual-write should hit both stores.
    if write_mode == "dual" and pg_repo is not None:
        if settings.dual_write_orders_primary == "mongo":
            return DualWriteChocolateRepository(
                mongo_repo, pg_repo, strict=settings.dual_write_strict
            )
        return DualWriteChocolateRepository(
            pg_repo, mongo_repo, strict=settings.dual_write_strict
        )

    if source == "mongo":
        return mongo_repo
    if source == "shadow":
        if pg_repo is None:
            raise RuntimeError("shadow catalog reads require Postgres session")
        return ShadowChocolateRepository(pg_repo, mongo_repo)
    if source == "postgres":
        if pg_repo is None:
            raise RuntimeError("postgres catalog reads require Postgres session")
        return pg_repo
    raise ValueError(f"Unknown DB_READ_SOURCE_CHOCOLATES={source!r}")
