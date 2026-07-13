from __future__ import annotations

from pathlib import Path
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]

ReadSourceChocolates = Literal["postgres", "shadow", "mongo"]
WriteModeOrders = Literal["postgres", "dual", "mongo"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", _ROOT / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Postgres remains optional for cutover / dual-write / backfill.
    database_url: Optional[str] = None
    redis_url: str
    cache_ttl_seconds: int = 60

    mongodb_enabled: bool = True
    mongodb_url: str = "mongodb://127.0.0.1:27017/chocolate_store"

    db_read_source_chocolates: ReadSourceChocolates = "mongo"
    db_write_mode_orders: WriteModeOrders = "mongo"
    # When dual-writing, fail the request if the secondary write fails.
    dual_write_strict: bool = True
    # dual: Postgres primary, Mongo secondary. dual_mongo_primary: reverse.
    dual_write_orders_primary: Literal["postgres", "mongo"] = Field(
        default="postgres",
        description="Which store is primary when DB_WRITE_MODE_ORDERS=dual",
    )


settings = Settings()
