from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.exceptions import RedisError
from pymongo.errors import PyMongoError

from app.cache import get_redis, close_redis
from app.db import close_db, get_database
from app.routers import admin, checkout, chocolates

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_redis()
    await close_db()


app = FastAPI(
    title="chocolate store API",
    version="0.2.0",
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
app.include_router(
    admin.router, prefix="/api/admin", tags=["admin"]
)


@app.get("/api/health")
async def health() -> dict[str, str | bool]:
    db_ok = False
    redis_ok = False
    try:
        await get_database().command("ping")
        db_ok = True
    except PyMongoError as e:
        log.warning("health db: %s", e)
    try:
        r = get_redis()
        if await r.ping():
            redis_ok = True
    except RedisError as e:
        log.warning("health redis: %s", e)
    return {"ok": db_ok and redis_ok, "database": db_ok, "redis": redis_ok}
