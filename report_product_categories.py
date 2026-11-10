import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

root = Path.cwd()
load_dotenv(root / ".env")
load_dotenv(root / "backend" / ".env", override=False)

async def main():
    url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")

    if not url or not db_name:
        raise SystemExit("ERROR: Database configuration missing.")

    client = AsyncIOMotorClient(url)
    db = client[db_name]

    print("\n========== CATEGORY DOCUMENTS ==========")
    async for category in db.categories.find({}):
        print({
            "name": category.get("name"),
            "slug": category.get("slug"),
            "id": str(category.get("_id")),
        })

    print("\n========== PRODUCT COUNTS BY CATEGORY SLUG ==========")
    pipeline = [
        {
            "$group": {
                "_id": "$category_slug",
                "total": {"$sum": 1},
                "missing_vendor": {
                    "$sum": {
                        "$cond": [
                            {
                                "$or": [
                                    {"$eq": [{"$ifNull": ["$vendor_id", None]}, None]},
                                    {"$eq": ["$vendor_id", ""]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]

    async for row in db.products.aggregate(pipeline):
        print(row)

    print("\n========== EXISTING VENDOR ID COUNTS ==========")
    pipeline = [
        {
            "$group": {
                "_id": {"$ifNull": ["$vendor_id", "(missing)"]},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1}},
    ]

    async for row in db.products.aggregate(pipeline):
        print({
            "vendor_id": str(row["_id"]),
            "count": row["count"],
        })

    client.close()

asyncio.run(main())
