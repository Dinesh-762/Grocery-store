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

    print("DATABASE:", db_name)

    print("\n========== PRODUCT COLLECTIONS ==========")
    print(await db.list_collection_names())

    print("\n========== SAMPLE PRODUCTS ==========")
    async for product in db.products.find({}).limit(5):
        for key, value in product.items():
            print(f"{key}: {value}")
        print("-" * 40)

    print("\n========== CATEGORY-LIKE FIELDS ==========")
    sample = await db.products.find_one({})
    if sample:
        for key, value in sample.items():
            if any(word in key.lower() for word in ("category", "vendor", "name", "type")):
                print(f"{key}: {value}")

    client.close()

asyncio.run(main())
