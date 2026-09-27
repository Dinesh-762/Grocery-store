import asyncio
import os
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


# ============================================================
# CONFIG
# ============================================================

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / "backend" / ".env"

load_dotenv(ENV_FILE)

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL is missing from backend/.env")

if not DB_NAME:
    raise RuntimeError("DB_NAME is missing from backend/.env")


# ============================================================
# HELPERS
# ============================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def variant(label, price, mrp, unit=None, stock=50):
    return {
        "label": label,
        "price": float(price),
        "base_price": float(price),
        "mrp": float(mrp),
        "unit": unit or label,
        "stock": stock,
    }


# ============================================================
# CATEGORIES
# ============================================================

CATEGORIES = [
    {
        "name": "Fruits & Vegetables",
        "slug": "fruits-vegetables",
    },
    {
        "name": "Dairy & Bakery",
        "slug": "dairy-bakery",
    },
    {
        "name": "Staples & Grains",
        "slug": "staples-grains",
    },
    {
        "name": "Spices & Masala",
        "slug": "spices-masala",
    },
    {
        "name": "Snacks & Beverages",
        "slug": "snacks-beverages",
    },
    {
        "name": "Personal Care",
        "slug": "personal-care",
    },
    {
        "name": "Cleaning & Household",
        "slug": "cleaning-household",
    },
]


# ============================================================
# PRODUCTS
#
# One product = one card.
# Different weights / pack sizes = variants.
#
# Only English product names are stored.
# Marathi names are NOT included.
# ============================================================

PRODUCTS = [

    # ========================================================
    # ATTA / RICE / DAL
    # ========================================================

    {
        "name": "Whole Wheat Atta",
        "slug": "whole-wheat-atta",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("5 kg", 210, 230),
            variant("10 kg", 410, 450),
        ],
    },

    {
        "name": "Maida",
        "slug": "maida",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 45, 50),
        ],
    },

    {
        "name": "Besan / Chana Flour",
        "slug": "besan-chana-flour",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 88, 95),
        ],
    },

    {
        "name": "Suji / Rava",
        "slug": "suji-rava",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 52, 60),
        ],
    },

    {
        "name": "Rice Flour",
        "slug": "rice-flour",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 48, 55),
        ],
    },

    {
        "name": "Regular Kolam Rice",
        "slug": "regular-kolam-rice",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("5 kg", 320, 350),
        ],
    },

    {
        "name": "Premium Basmati Rice",
        "slug": "premium-basmati-rice",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 125, 140),
        ],
    },

    {
        "name": "Thick Poha",
        "slug": "thick-poha",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 52, 60),
        ],
    },

    {
        "name": "Toor Dal",
        "slug": "toor-dal",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 160, 175),
        ],
    },

    {
        "name": "Moong Dal",
        "slug": "moong-dal",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 118, 130),
        ],
    },

    {
        "name": "Chana Dal",
        "slug": "chana-dal",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 85, 95),
        ],
    },

    {
        "name": "Urad Dal",
        "slug": "urad-dal",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 132, 145),
        ],
    },

    {
        "name": "Masoor Dal",
        "slug": "masoor-dal",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 98, 110),
        ],
    },

    {
        "name": "Kabuli Chana",
        "slug": "kabuli-chana",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 145, 160),
        ],
    },

    {
        "name": "Rajma",
        "slug": "rajma",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 135, 150),
        ],
    },


    # ========================================================
    # OIL / GHEE
    # ========================================================

    {
        "name": "Sunflower Oil",
        "slug": "sunflower-oil",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 L", 142, 155),
        ],
    },

    {
        "name": "Groundnut / Peanut Oil",
        "slug": "groundnut-peanut-oil",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 L", 180, 195),
        ],
    },

    {
        "name": "Mustard Oil",
        "slug": "mustard-oil",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 L", 150, 165),
        ],
    },

    {
        "name": "Pure Cow Ghee",
        "slug": "pure-cow-ghee",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 L", 599, 650),
        ],
    },


    # ========================================================
    # SPICES
    # ========================================================

    {
        "name": "Turmeric Powder",
        "slug": "turmeric-powder",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("250 g", 65, 75),
        ],
    },

    {
        "name": "Red Chilli Powder",
        "slug": "red-chilli-powder",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("250 g", 80, 90),
        ],
    },

    {
        "name": "Coriander Powder",
        "slug": "coriander-powder",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("250 g", 60, 70),
        ],
    },

    {
        "name": "Garam Masala",
        "slug": "garam-masala",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("100 g", 75, 85),
        ],
    },

    {
        "name": "Cumin Seeds / Jeera",
        "slug": "cumin-seeds-jeera",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("200 g", 105, 120),
        ],
    },

    {
        "name": "Mustard Seeds / Rai",
        "slug": "mustard-seeds-rai",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("200 g", 42, 50),
        ],
    },

    {
        "name": "Hing / Asafoetida",
        "slug": "hing-asafoetida",
        "category_slug": "spices-masala",
        "image": "",
        "variants": [
            variant("50 g", 58, 65),
        ],
    },


    # ========================================================
    # STAPLES
    # ========================================================

    {
        "name": "Iodized Salt",
        "slug": "iodized-salt",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 25, 28),
        ],
    },

    {
        "name": "Refined Sugar",
        "slug": "refined-sugar",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 44, 48),
        ],
    },

    {
        "name": "Pure Jaggery",
        "slug": "pure-jaggery",
        "category_slug": "staples-grains",
        "image": "",
        "variants": [
            variant("1 kg", 60, 70),
        ],
    },


    # ========================================================
    # DAIRY & BAKERY
    # ========================================================

    {
        "name": "Fresh Milk Pouch",
        "slug": "fresh-milk-pouch",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("500 ml", 34, 34),
        ],
    },

    {
        "name": "Fresh Paneer",
        "slug": "fresh-paneer",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("200 g", 82, 90),
        ],
    },

    {
        "name": "Fresh Curd / Dahi",
        "slug": "fresh-curd-dahi",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("400 g", 40, 45),
        ],
    },

    {
        "name": "Salted Butter",
        "slug": "salted-butter",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("100 g", 56, 60),
        ],
    },

    {
        "name": "Cheese Slices",
        "slug": "cheese-slices",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("200 g", 135, 145),
        ],
    },

    {
        "name": "White Bread",
        "slug": "white-bread",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("400 g", 38, 40),
        ],
    },

    {
        "name": "Fresh Pav",
        "slug": "fresh-pav",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("Pack of 6", 25, 25),
        ],
    },

    {
        "name": "Rusk Toast",
        "slug": "rusk-toast",
        "category_slug": "dairy-bakery",
        "image": "",
        "variants": [
            variant("300 g", 45, 50),
        ],
    },


    # ========================================================
    # FRESH PRODUCE
    # ========================================================

    {
        "name": "Fresh Onion",
        "slug": "fresh-onion",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("1 kg", 35, 40),
        ],
    },

    {
        "name": "Potato",
        "slug": "potato",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("1 kg", 30, 35),
        ],
    },

    {
        "name": "Tomato",
        "slug": "tomato",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("1 kg", 38, 45),
        ],
    },

    {
        "name": "Ginger",
        "slug": "ginger",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("250 g", 35, 40),
        ],
    },

    {
        "name": "Garlic",
        "slug": "garlic",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("250 g", 55, 65),
        ],
    },

    {
        "name": "Green Chillies",
        "slug": "green-chillies",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("250 g", 20, 25),
        ],
    },

    {
        "name": "Fresh Coriander",
        "slug": "fresh-coriander",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("1 Bunch", 15, 20),
        ],
    },

    {
        "name": "Banana",
        "slug": "banana",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("12 pcs", 50, 60),
        ],
    },

    {
        "name": "Fresh Lemon",
        "slug": "fresh-lemon",
        "category_slug": "fruits-vegetables",
        "image": "",
        "variants": [
            variant("5 pcs", 20, 25),
        ],
    },


    # ========================================================
    # SNACKS & BEVERAGES
    # ========================================================

    {
        "name": "CTC Leaf Tea",
        "slug": "ctc-leaf-tea",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("500 g", 235, 260),
        ],
    },

    {
        "name": "Instant Coffee",
        "slug": "instant-coffee",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("100 g", 175, 195),
        ],
    },

    {
        "name": "Marie / Glucose Biscuits",
        "slug": "marie-glucose-biscuits",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("Family Pack", 45, 50),
        ],
    },

    {
        "name": "Farsan / Shev",
        "slug": "farsan-shev",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("400 g", 80, 90),
        ],
    },

    {
        "name": "Instant Noodles",
        "slug": "instant-noodles",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("4 Pack", 55, 60),
        ],
    },

    {
        "name": "Tomato Ketchup",
        "slug": "tomato-ketchup",
        "category_slug": "snacks-beverages",
        "image": "",
        "variants": [
            variant("1 kg", 120, 140),
        ],
    },


    # ========================================================
    # CLEANING & HOUSEHOLD
    # ========================================================

    {
        "name": "Detergent Powder",
        "slug": "detergent-powder",
        "category_slug": "cleaning-household",
        "image": "",
        "variants": [
            variant("1 kg", 125, 140),
        ],
    },

    {
        "name": "Dishwash Bar / Liquid",
        "slug": "dishwash-bar-liquid",
        "category_slug": "cleaning-household",
        "image": "",
        "variants": [
            variant("500 ml", 99, 115),
        ],
    },

    {
        "name": "Floor Cleaner Liquid",
        "slug": "floor-cleaner-liquid",
        "category_slug": "cleaning-household",
        "image": "",
        "variants": [
            variant("1 L", 160, 185),
        ],
    },

    {
        "name": "Toilet Cleaner",
        "slug": "toilet-cleaner",
        "category_slug": "cleaning-household",
        "image": "",
        "variants": [
            variant("500 ml", 88, 98),
        ],
    },


    # ========================================================
    # PERSONAL CARE
    # ========================================================

    {
        "name": "Bathing Soap",
        "slug": "bathing-soap",
        "category_slug": "personal-care",
        "image": "",
        "variants": [
            variant("Pack of 4", 140, 160),
        ],
    },

    {
        "name": "Toothpaste",
        "slug": "toothpaste",
        "category_slug": "personal-care",
        "image": "",
        "variants": [
            variant("150 g", 98, 110),
        ],
    },

    {
        "name": "Handwash Liquid",
        "slug": "handwash-liquid",
        "category_slug": "personal-care",
        "image": "",
        "variants": [
            variant("750 ml", 110, 130),
        ],
    },
]


# ============================================================
# IMPORT
# ============================================================

async def main():

    print()
    print("=" * 60)
    print("       AMBAJOGAI GROCERY PRODUCT IMPORT")
    print("=" * 60)
    print()

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    inserted = 0
    updated = 0
    skipped = 0

    try:

        # ----------------------------------------------------
        # CREATE CATEGORIES
        # ----------------------------------------------------

        print("Checking categories...")

        for category in CATEGORIES:

            await db.categories.update_one(
                {"slug": category["slug"]},
                {
                    "$setOnInsert": {
                        "name": category["name"],
                        "slug": category["slug"],
                        "created_at": now_iso(),
                    }
                },
                upsert=True,
            )

        print("Categories ready.\n")

        # ----------------------------------------------------
        # PRODUCTS
        # ----------------------------------------------------

        for product in PRODUCTS:

            variants = product["variants"]

            # First variant becomes base product price.
            first_variant = variants[0]

            document = {
                "name": product["name"],
                "slug": product["slug"],
                "description": "",
                "price": first_variant["price"],
                "base_price": first_variant["price"],
                "mrp": first_variant["mrp"],
                "unit": first_variant["unit"],
                "category_slug": product["category_slug"],
                "image": product["image"],
                "stock": 50,
                "featured": False,
                "popular": False,
                "variants": variants,
                "approval_status": "approved",
                "product_status": "active",
            }

            existing = await db.products.find_one(
                {"slug": product["slug"]}
            )

            # ------------------------------------------------
            # IMPORTANT:
            # Existing products with the SAME slug are updated
            # to the new variant-based structure.
            # ------------------------------------------------

            if existing:

                await db.products.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": document,
                    }
                )

                updated += 1

                print(
                    f"UPDATED | {product['name']} | "
                    f"{len(variants)} variant(s)"
                )

            else:

                document["created_at"] = now_iso()

                await db.products.insert_one(document)

                inserted += 1

                print(
                    f"ADDED   | {product['name']} | "
                    f"{len(variants)} variant(s)"
                )

        # ----------------------------------------------------
        # SUMMARY
        # ----------------------------------------------------

        print()
        print("=" * 60)
        print("IMPORT COMPLETE")
        print("=" * 60)
        print(f"Products in script : {len(PRODUCTS)}")
        print(f"Inserted            : {inserted}")
        print(f"Updated             : {updated}")
        print(f"Skipped             : {skipped}")
        print("=" * 60)
        print()

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())