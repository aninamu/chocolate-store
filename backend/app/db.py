from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

engine: Optional[AsyncEngine] = None
AsyncSessionFactory: Optional[async_sessionmaker[AsyncSession]] = None

if settings.database_url:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
    )
    AsyncSessionFactory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


def postgres_available() -> bool:
    return AsyncSessionFactory is not None


async def get_db() -> AsyncIterator[AsyncSession]:
    if AsyncSessionFactory is None:
        raise RuntimeError(
            "Postgres is not configured (DATABASE_URL). "
            "Set DATABASE_URL or use Mongo-only mode."
        )
    async with AsyncSessionFactory() as session:
        yield session


async def dispose_engine() -> None:
    if engine is not None:
        await engine.dispose()
