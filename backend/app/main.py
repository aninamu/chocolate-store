from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.cache import get_redis, close_redis
from app.config import settings
from app.db import AsyncSessionFactory, dispose_engine, postgres_available
from app.mongo import close_mongo, init_mongo, ping_mongo
from app.routers import checkout, chocolates

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if settings.mongodb_enabled:
        await init_mongo()
    yield
    await close_redis()
    await close_mongo()
    await dispose_engine()


app = FastAPI(
    title="chocolate store API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    chocolates.router, prefix="/api/chocolates", tags=["chocolates"]
)
app.include_router(
    checkout.router, prefix="/api", tags=["checkout"]
)


@app.get("/api/health")
async def health() -> dict[str, str | bool]:
    postgres_ok = False
    mongodb_ok = False
    redis_ok = False

    if postgres_available() and AsyncSessionFactory is not None:
        try:
            async with AsyncSessionFactory() as s:
                await s.execute(text("SELECT 1"))
                postgres_ok = True
        except SQLAlchemyError as e:
            log.warning("health postgres: %s", e)

    if settings.mongodb_enabled:
        mongodb_ok = await ping_mongo()

    try:
        r = get_redis()
        if await r.ping():
            redis_ok = True
    except RedisError as e:
        log.warning("health redis: %s", e)

    # Required stores depend on active cutover flags.
    needs_pg = settings.db_read_source_chocolates in (
        "postgres",
        "shadow",
    ) or settings.db_write_mode_orders in ("postgres", "dual")
    needs_mongo = settings.mongodb_enabled and (
        settings.db_read_source_chocolates in ("mongo", "shadow")
        or settings.db_write_mode_orders in ("mongo", "dual")
    )

    stores_ok = redis_ok
    if needs_pg:
        stores_ok = stores_ok and postgres_ok
    if needs_mongo:
        stores_ok = stores_ok and mongodb_ok

    return {
        "ok": stores_ok,
        "database": mongodb_ok if settings.db_read_source_chocolates == "mongo" else postgres_ok,
        "postgres": postgres_ok,
        "mongodb": mongodb_ok,
        "redis": redis_ok,
        "read_source_chocolates": settings.db_read_source_chocolates,
        "write_mode_orders": settings.db_write_mode_orders,
    }
