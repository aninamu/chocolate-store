"""Demo seed data for the chocolate store.

Edit the SEED list below to change what appears in the store. The data is
loaded into a freshly-created database on every `make dev` by
``backend/app/init_db.py``.
"""
from __future__ import annotations

import re
import unicodedata


def slugify(name: str) -> str:
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
        "image_url": "https://images.unsplash.com/photo-1493925410384-84f842e616fb?w=600&q=80",
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
        "image_url":"https://images.unsplash.com/photo-1772985433602-f2725a31d547?w=600&q=80",
        "tags": ["dark", "caramel", "salt"],
    },
    {
        "name": "Hazelnut Praline Milk",
        "description": "Roasted hazelnut praline and milk chocolate — smooth, nutty, crowd-pleasing.",
        "origin": "Piedmont, Italy",
        "cacao_percentage": 40,
        "price_cents": 799,
        "image_url": "https://images.unsplash.com/photo-1630953900279-8efae9d0e4d9?w=600&q=80",
        "tags": ["milk", "nutty", "praline"],
    },
    {
        "name": "Classic Milk Bar",
        "description": "The everyday bar: creamy, sweet, and balanced for hot cocoa or snacking.",
        "origin": "Vermont, USA",
        "cacao_percentage": 38,
        "price_cents": 499,
        "image_url": "https://images.unsplash.com/photo-1619848566843-9027f3c7aac2?w=600&q=80",
        "tags": ["milk", "classic"],
    },
    {
        "name": "Ruby Berry Bar",
        "description": "Naturally pink ruby cocoa with tart berry notes — no added color.",
        "origin": "Belgium",
        "cacao_percentage": 47,
        "price_cents": 949,
        "image_url": "https://images.unsplash.com/photo-1608932586368-b4266fe7f98c?w=600&q=80",
        "tags": ["ruby", "fruity"],
    },
    {
        "name": "White Chocolate & Pistachio",
        "description": "Creamy white chocolate studded with pistachio and a whisper of vanilla.",
        "origin": "Turkey",
        "cacao_percentage": 0,
        "price_cents": 899,
        "image_url": "https://images.unsplash.com/photo-1706167754832-78f1fda7226c?w=600&q=80",
        "tags": ["white", "nutty"],
    },
    {
        "name": "Vegan Almond Dark",
        "description": "72% dark with almond butter and oat milk — bold, nutty, fully plant-based.",
        "origin": "Oregon, USA",
        "cacao_percentage": 72,
        "price_cents": 849,
        "image_url": "https://images.unsplash.com/photo-1720029106261-0d0396bb270d?w=600&q=80",
        "tags": ["dark", "vegan", "almond"],
    },
    {
        "name": "Raspberry Truffle Box (12)",
        "description": "A dozen velvety ganache truffles with raspberry confit centers.",
        "origin": "France",
        "cacao_percentage": 55,
        "price_cents": 2499,
        "image_url": "https://images.unsplash.com/photo-1526823127573-0fda76b6c24f?w=600&q=80",
        "tags": ["gift", "truffle", "fruit"],
    },
    {
        "name": "Chili & Cinnamon Dark",
        "description": "Warm spices and a gentle heat that builds into a smooth dark finish.",
        "origin": "Mexico",
        "cacao_percentage": 68,
        "price_cents": 799,
        "image_url": "https://images.unsplash.com/photo-1601876819169-9ddf6f214a47?w=600&q=80",
        "tags": ["dark", "spicy"],
    },
    {
        "name": "Orange Zest 65%",
        "description": "Infused with cold-pressed orange oil — like a marmalade memory in each bite.",
        "origin": "Spain",
        "cacao_percentage": 65,
        "price_cents": 729,
        "image_url": "https://images.unsplash.com/photo-1611625309355-44750e8b3498?w=600&q=80",
        "tags": ["dark", "citrus"],
    },
    {
        "name": "Fresh Mint Dark Bites",
        "description": "Encapsulated mint essence in 60% dark — cool, not toothpaste.",
        "origin": "Switzerland",
        "cacao_percentage": 60,
        "price_cents": 899,
        "image_url": "https://images.unsplash.com/photo-1636450525985-f38e86fd4759?w=600&q=80",
        "tags": ["dark", "mint", "bites"],
    },
    {
        "name": "Gianduja Spread Jar",
        "description": "Hazelnut and cocoa in spreadable form — perfect on toast or off a spoon.",
        "origin": "Piedmont, Italy",
        "cacao_percentage": 32,
        "price_cents": 1299,
        "image_url": "https://images.unsplash.com/photo-1551578657-a7e74acb0135?w=600&q=80",
        "tags": ["spread", "hazelnut"],
    },
    {
        "name": "Cocoa Nibs Crunch 72%",
        "description": "Extra cocoa nibs folded in for snap and a slow chocolate bloom.",
        "origin": "Peru",
        "cacao_percentage": 72,
        "price_cents": 819,
        "image_url": "https://images.unsplash.com/photo-1587271644048-2fbb187de8d8?w=600&q=80",
        "tags": ["dark", "nibs", "textured"],
    },
]

# Fixed demo user IDs for predictable tests and frontend defaults.
DEMO_USER_ALICE = "00000000-0000-4000-8000-000000000001"
DEMO_USER_BOB = "00000000-0000-4000-8000-000000000002"
DEMO_USER_MOD = "00000000-0000-4000-8000-000000000003"

SOCIAL_USERS: list[dict] = [
    {
        "id": DEMO_USER_ALICE,
        "name": "Alice Chen",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
        "is_moderator": False,
    },
    {
        "id": DEMO_USER_BOB,
        "name": "Bob Rivera",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
        "is_moderator": False,
    },
    {
        "id": DEMO_USER_MOD,
        "name": "Mod Team",
        "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
        "is_moderator": True,
    },
]

# Posts reference chocolates by slug (resolved in init_db).
SOCIAL_POSTS: list[dict] = [
    {
        "author_id": DEMO_USER_ALICE,
        "chocolate_slug": "ecuador-single-origin-70",
        "text": "Just tried this bar — the fig notes are incredible with espresso.",
        "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80",
    },
    {
        "author_id": DEMO_USER_BOB,
        "chocolate_slug": "madagascar-sambirano-85",
        "text": "85% that still feels fruity. Perfect after dinner.",
        "image_url": None,
    },
    {
        "author_id": DEMO_USER_ALICE,
        "chocolate_slug": None,
        "text": "Anyone else pairing dark chocolate with orange peel?",
        "image_url": None,
    },
]

SOCIAL_COMMENTS: list[dict] = [
    {
        "post_index": 0,
        "author_id": DEMO_USER_BOB,
        "text": "Agreed — I add a pinch of flaky salt on top.",
    },
    {
        "post_index": 2,
        "author_id": DEMO_USER_BOB,
        "text": "Orange Zest 65% is made for that combo.",
    },
]

SOCIAL_LIKES: list[dict] = [
    {"post_index": 0, "user_id": DEMO_USER_BOB},
    {"post_index": 0, "user_id": DEMO_USER_MOD},
    {"post_index": 1, "user_id": DEMO_USER_ALICE},
]


