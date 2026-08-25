from pathlib import Path

p = Path("backend/server.py")
s = p.read_text(encoding="utf-8")

old = '''@api.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
'''

new = '''@api.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    print("=== CREATE ORDER START ===")
    print("USER:", user.get("email") if user else None)
    print("ITEM COUNT:", len(payload.items) if payload.items else 0)
'''

if old not in s:
    print("TARGET NOT FOUND")
else:
    s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")
    print("DEBUG LOGGING ADDED")
