"""Unit tests for dual-write / cutover repository wrappers."""
from __future__ import annotations

import uuid
from typing import Any

import pytest

from app.repositories.chocolates import DualWriteChocolateRepository, ShadowChocolateRepository
from app.repositories.orders import DualWriteOrderRepository
from app.schemas.chocolate import CartLineIn, CheckoutOut, ChocolateOut


def _sample_chocolate(cid: uuid.UUID | None = None) -> ChocolateOut:
    from datetime import datetime, timezone

    return ChocolateOut(
        id=cid or uuid.uuid4(),
        name="Test Bar",
        slug="test-bar",
        description="desc",
        origin="Nowhere",
        cacao_percentage=70,
        price_cents=500,
        image_url="https://example.com/x.jpg",
        churrito_quote="woof",
        tags=["dark"],
        in_stock=True,
        created_at=datetime.now(timezone.utc),
    )


class FakeChocolateRepo:
    def __init__(self, rows: list[ChocolateOut] | None = None, *, fail: bool = False) -> None:
        self.rows = rows or [_sample_chocolate()]
        self.fail = fail
        self.set_calls: list[tuple[uuid.UUID, bool]] = []

    async def list(self, *, tags: list[str] | None, sort: str | None) -> list[ChocolateOut]:
        if self.fail:
            raise RuntimeError("boom")
        return list(self.rows)

    async def get_by_id(self, chocolate_id: uuid.UUID) -> ChocolateOut | None:
        if self.fail:
            raise RuntimeError("boom")
        for r in self.rows:
            if r.id == chocolate_id:
                return r
        return None

    async def set_in_stock(self, chocolate_id: uuid.UUID, in_stock: bool) -> None:
        if self.fail:
            raise RuntimeError("boom")
        self.set_calls.append((chocolate_id, in_stock))


class FakeOrderRepo:
    def __init__(self, *, fail: bool = False, label: str = "primary") -> None:
        self.fail = fail
        self.label = label
        self.calls: list[dict[str, Any]] = []

    async def create_checkout(
        self,
        *,
        customer_name: str,
        customer_email: str,
        items: list[CartLineIn],
        chocolate_repo: Any,
        order_id: uuid.UUID | None = None,
    ) -> CheckoutOut:
        self.calls.append(
            {
                "customer_name": customer_name,
                "customer_email": customer_email,
                "items": items,
                "order_id": order_id,
            }
        )
        if self.fail:
            raise RuntimeError(f"{self.label} failed")
        oid = order_id or uuid.uuid4()
        total = sum(500 * line.quantity for line in items)
        return CheckoutOut(order_id=oid, total_cents=total)


@pytest.mark.asyncio
async def test_shadow_catalog_serves_primary_and_tolerates_shadow_failure() -> None:
    primary = FakeChocolateRepo()
    shadow = FakeChocolateRepo(fail=True)
    repo = ShadowChocolateRepository(primary, shadow)
    rows = await repo.list(tags=None, sort="name")
    assert len(rows) == 1
    assert rows[0].name == "Test Bar"


@pytest.mark.asyncio
async def test_dual_write_orders_pg_primary_writes_both() -> None:
    primary = FakeOrderRepo(label="pg")
    secondary = FakeOrderRepo(label="mongo")
    repo = DualWriteOrderRepository(primary, secondary, strict=True)
    ch = FakeChocolateRepo()
    out = await repo.create_checkout(
        customer_name="Ada",
        customer_email="ada@example.com",
        items=[CartLineIn(chocolate_id=ch.rows[0].id, quantity=2)],
        chocolate_repo=ch,
    )
    assert out.total_cents == 1000
    assert len(primary.calls) == 1
    assert len(secondary.calls) == 1
    assert secondary.calls[0]["order_id"] == out.order_id


@pytest.mark.asyncio
async def test_dual_write_orders_mongo_primary() -> None:
    primary = FakeOrderRepo(label="mongo")
    secondary = FakeOrderRepo(label="pg")
    repo = DualWriteOrderRepository(primary, secondary, strict=True)
    ch = FakeChocolateRepo()
    out = await repo.create_checkout(
        customer_name="Ada",
        customer_email="ada@example.com",
        items=[CartLineIn(chocolate_id=ch.rows[0].id, quantity=1)],
        chocolate_repo=ch,
    )
    assert out.order_id == primary.calls[0]["order_id"]
    assert secondary.calls[0]["order_id"] == out.order_id


@pytest.mark.asyncio
async def test_dual_write_strict_raises_on_secondary_failure() -> None:
    primary = FakeOrderRepo(label="pg")
    secondary = FakeOrderRepo(label="mongo", fail=True)
    repo = DualWriteOrderRepository(primary, secondary, strict=True)
    ch = FakeChocolateRepo()
    with pytest.raises(RuntimeError, match="mongo failed"):
        await repo.create_checkout(
            customer_name="Ada",
            customer_email="ada@example.com",
            items=[CartLineIn(chocolate_id=ch.rows[0].id, quantity=1)],
            chocolate_repo=ch,
        )


@pytest.mark.asyncio
async def test_dual_write_chocolates_set_in_stock_both() -> None:
    primary = FakeChocolateRepo()
    secondary = FakeChocolateRepo()
    repo = DualWriteChocolateRepository(primary, secondary, strict=True)
    cid = primary.rows[0].id
    await repo.set_in_stock(cid, False)
    assert primary.set_calls == [(cid, False)]
    assert secondary.set_calls == [(cid, False)]
