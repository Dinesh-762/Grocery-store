import asyncio
from backend.server import db

async def main():
    email = "admin@ambajogai.com".lower().strip()

    user = await db.users.find_one(
        {"email": email},
        {"_id": 1, "email": 1, "role": 1, "password_hash": 1}
    )

    if user:
        print("USER FOUND")
        print("email:", user.get("email"))
        print("role:", user.get("role"))
        print("password_hash exists:", bool(user.get("password_hash")))
    else:
        print("USER NOT FOUND")

asyncio.run(main())
