import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

root = Path.cwd()

load_dotenv(root / ".env")
load_dotenv(root / "backend" / ".env", override=False)

mongo_url = os.getenv("MONGO_URL")
db_name = os.getenv("DB_NAME")

if not mongo_url or not db_name:
    raise SystemExit(
        "ERROR: MONGO_URL or DB_NAME missing. Check your backend .env file."
    )

async def main():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print("\n========== VENDORS ==========")

    async for vendor in db.vendors.find(
        {},
        {
            "name": 1,
            "business_name": 1,
            "shop_name": 1,
            "store_name": 1,
            "business_latitude": 1,
            "business_longitude": 1,
        }
    ):
        print({
            "id": str(vendor["_id"]),
            "name": vendor.get("name"),
            "business_name": vendor.get("business_name"),
            "shop_name": vendor.get("shop_name"),
            "store_name": vendor.get("store_name"),
            "latitude": vendor.get("business_latitude"),
            "longitude": vendor.get("business_longitude"),
        })

    print("\n========== PRODUCT CATEGORIES ==========")

    categories = await db.products.distinct("category")

    for category in sorted(
        [str(c) for c in categories if c is not None],
        key=str.lower
    ):
        count = await db.products.count_documents({"category": category})
        print(f"{category}: {count} products")

    print("\n========== PRODUCTS WITHOUT VENDOR ==========")

    missing_count = await db.products.count_documents({
        "$or": [
            {"vendor_id": {"$exists": False}},
            {"vendor_id": None},
            {"vendor_id": ""},
        ]
    })

    print(f"Products without vendor_id: {missing_count}")

    client.close()

asyncio.run(main())
