from __future__ import annotations

"""Initial schema: chocolates, orders, order_items

Revision ID: 0001
Revises:
Create Date: 2025-01-01

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chocolates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("origin", sa.String(120), nullable=True),
        sa.Column("cacao_percentage", sa.Integer(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(2000), nullable=False),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String(64)),
            server_default=sa.text("'{}'::character varying(64)[]"),
            nullable=False,
        ),
        sa.Column("in_stock", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chocolates_slug"), "chocolates", ["slug"], unique=True)

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("customer_email", sa.String(320), nullable=False),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chocolate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["chocolate_id"],
            ["chocolates.id"],
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_order_items_chocolate_id"), "order_items", ["chocolate_id"]
    )
    op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_order_items_order_id"), table_name="order_items")
    op.drop_index(op.f("ix_order_items_chocolate_id"), table_name="order_items")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_index(op.f("ix_chocolates_slug"), table_name="chocolates")
    op.drop_table("chocolates")
