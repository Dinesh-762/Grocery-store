import sys
import asyncio

sys.path.insert(0, r".\backend")

import server

async def main():
    print("DATABASE:", server.DB_NAME)

    docs = await server.db.products.find(
        {},
        {
            "name": 1,
            "slug": 1,
            "price": 1,
            "mrp": 1,
            "base_price": 1,
            "unit": 1,
            "category_slug": 1,
            "variants": 1,
            "stock": 1
        }
    ).sort("name", 1).to_list(None)

    print(f"\nTOTAL PRODUCTS: {len(docs)}\n")
    print("=" * 100)

    for i, p in enumerate(docs, 1):
        print(f"{i}. {p.get('name')}")
        print(f"   ID       : {p.get('_id')}")
        print(f"   Slug     : {p.get('slug')}")
        print(f"   Price    : {p.get('price')}")
        print(f"   MRP      : {p.get('mrp')}")
        print(f"   Base     : {p.get('base_price')}")
        print(f"   Unit     : {p.get('unit')}")
        print(f"   Category : {p.get('category_slug')}")
        print(f"   Stock    : {p.get('stock')}")
        print(f"   Variants : {p.get('variants')}")
        print("-" * 100)

    print("\nDONE - READ ONLY. NO DATABASE CHANGES WERE MADE.")

asyncio.run(main())

