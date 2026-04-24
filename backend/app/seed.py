"""Idempotent seed: inserts ~14 chocolates if the table is empty."""
from __future__ import annotations

import asyncio
import re
import unicodedata

from sqlalchemy import select

from app.db import AsyncSessionFactory
from app.models.chocolate import Chocolate


def _slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "chocolate"


SEED: list[dict] = [
    {
        "name": "Ecuador Single-Origin 70%",
        "description": "Stone-ground dark from high-elevation Nacional beans. Notes of black tea, fig, and toasted almond.",
        "origin": "Ecuador",
        "cacao_percentage": 70,
        "price_cents": 899,
        "image_url": "https://images.unsplash.com/photo-1606312619070-d48b4bc89d90?w=600&q=80",
        "tags": ["dark", "single-origin", "70%"],
    },
    {
        "name": "Madagascar Sambirano 85%",
        "description": "Intense and bright with red fruit, a touch of smoke, and a long finish.",
        "origin": "Madagascar",
        "cacao_percentage": 85,
        "price_cents": 1099,
        "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=80",
        "tags": ["dark", "single-origin", "85%"],
    },
    {
        "name": "Sea Salt Caramel Dark",
        "description": "Silky caramel folded into 64% dark with flaked sea salt for balance.",
        "origin": "California, USA",
        "cacao_percentage": 64,
        "price_cents": 749,
        "image_url": "https://images.unsplash.com/photo-1481391319762-704b3b1b1b1b?w=600&q=80",
        "tags": ["dark", "caramel", "salt"],
    },
    {
        "name": "Hazelnut Praline Milk",
        "description": "Roasted hazelnut praline and milk chocolate — smooth, nutty, crowd-pleasing.",
        "origin": "Piedmont, Italy",
        "cacao_percentage": 40,
        "price_cents": 799,
        "image_url": "https://images.unsplash.com/photo-1590080876351-94150c4f9a4a?w=600&q=80",
        "tags": ["milk", "nutty", "praline"],
    },
    {
        "name": "Classic Milk Bar",
        "description": "The everyday bar: creamy, sweet, and balanced for hot cocoa or snacking.",
        "origin": "Vermont, USA",
        "cacao_percentage": 38,
        "price_cents": 499,
        "image_url": "https://images.unsplash.com/photo-1614082242764-7b57b0a0d0e5?w=600&q=80",
        "tags": ["milk", "classic"],
    },
    {
        "name": "Ruby Berry Bar",
        "description": "Naturally pink ruby cocoa with tart berry notes — no added color.",
        "origin": "Belgium",
        "cacao_percentage": 47,
        "price_cents": 949,
        "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=80",
        "tags": ["ruby", "fruity"],
    },
    {
        "name": "White Chocolate & Pistachio",
        "description": "Creamy white chocolate studded with pistachio and a whisper of vanilla.",
        "origin": "Turkey",
        "cacao_percentage": 0,
        "price_cents": 899,
        "image_url": "https://images.unsplash.com/photo-1589301760014-92917a2b4b2a?w=600&q=80",
        "tags": ["white", "nutty"],
    },
    {
        "name": "Vegan Almond Dark",
        "description": "72% dark with almond butter and oat milk — bold, nutty, fully plant-based.",
        "origin": "Oregon, USA",
        "cacao_percentage": 72,
        "price_cents": 849,
        "image_url": "https://images.unsplash.com/photo-1606312619070-d48b4bc89d90?w=600&q=80",
        "tags": ["dark", "vegan", "almond"],
    },
    {
        "name": "Raspberry Truffle Box (12)",
        "description": "A dozen velvety ganache truffles with raspberry confit centers.",
        "origin": "France",
        "cacao_percentage": 55,
        "price_cents": 2499,
        "image_url": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&q=80",
        "tags": ["gift", "truffle", "fruit"],
    },
    {
        "name": "Chili & Cinnamon Dark",
        "description": "Warm spices and a gentle heat that builds into a smooth dark finish.",
        "origin": "Mexico",
        "cacao_percentage": 68,
        "price_cents": 799,
        "image_url": "https://images.unsplash.com/photo-1511920170033-839693406c34?w=600&q=80",
        "tags": ["dark", "spicy"],
    },
    {
        "name": "Orange Zest 65%",
        "description": "Infused with cold-pressed orange oil — like a marmalade memory in each bite.",
        "origin": "Spain",
        "cacao_percentage": 65,
        "price_cents": 729,
        "image_url": "https://images.unsplash.com/photo-1509042239860-f550d6e7e6e5?w=600&q=80",
        "tags": ["dark", "citrus"],
    },
    {
        "name": "Fresh Mint Dark Bites",
        "description": "Encapsulated mint essence in 60% dark — cool, not toothpaste.",
        "origin": "Switzerland",
        "cacao_percentage": 60,
        "price_cents": 899,
        "image_url": "https://images.unsplash.com/photo-1563805042-7680d9e0c5d5?w=600&q=80",
        "tags": ["dark", "mint", "bites"],
    },
    {
        "name": "Gianduja Spread Jar",
        "description": "Hazelnut and cocoa in spreadable form — perfect on toast or off a spoon.",
        "origin": "Piedmont, Italy",
        "cacao_percentage": 32,
        "price_cents": 1299,
        "image_url": "https://images.unsplash.com/photo-1519708227418-8a6e4c0c5c4c?w=600&q=80",
        "tags": ["spread", "hazelnut"],
    },
    {
        "name": "Cocoa Nibs Crunch 72%",
        "description": "Extra cocoa nibs folded in for snap and a slow chocolate bloom.",
        "origin": "Peru",
        "cacao_percentage": 72,
        "price_cents": 819,
        "image_url": "https://images.unsplash.com/photo-1505576391880-b0f0e8a5e6e6?w=600&q=80",
        "tags": ["dark", "nibs", "textured"],
    },
]


async def _run() -> None:
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(Chocolate).limit(1))
        if result.scalar_one_or_none() is not None:
            print("seed: skipped (chocolates already present)")
            return
        for row in SEED:
            session.add(
                Chocolate(
                    name=row["name"],
                    slug=_slug(row["name"]),
                    description=row["description"],
                    origin=row.get("origin"),
                    cacao_percentage=row.get("cacao_percentage"),
                    price_cents=row["price_cents"],
                    image_url=row["image_url"],
                    tags=row["tags"],
                    in_stock=True,
                )
            )
        await session.commit()
        print(f"seed: inserted {len(SEED)} chocolates")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
