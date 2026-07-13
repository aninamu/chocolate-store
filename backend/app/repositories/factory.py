from __future__ import annotations

from typing import Optional

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import postgres_available
from app.repositories.chocolates import ChocolateRepository, build_chocolate_repository
from app.repositories.orders import OrderRepository, build_order_repository


def _needs_postgres_session() -> bool:
    if not postgres_available():
        return False
    if settings.db_read_source_chocolates in ("postgres", "shadow"):
        return True
    if settings.db_write_mode_orders in ("postgres", "dual"):
        return True
    return False


async def get_optional_db_session() -> Optional[AsyncSession]:
    """Yield a Postgres session only when the active flags still need one."""
    if not _needs_postgres_session():
        yield None
        return
    from app.db import AsyncSessionFactory

    assert AsyncSessionFactory is not None
    async with AsyncSessionFactory() as session:
        yield session


def get_chocolate_repo(
    session: Optional[AsyncSession] = Depends(get_optional_db_session),
) -> ChocolateRepository:
    return build_chocolate_repository(session)


def get_order_repo(
    session: Optional[AsyncSession] = Depends(get_optional_db_session),
) -> OrderRepository:
    return build_order_repository(session)
