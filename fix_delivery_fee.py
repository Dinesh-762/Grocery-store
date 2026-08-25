from pathlib import Path

path = Path("backend/server.py")
text = path.read_text(encoding="utf-8")

old = '''        delivery_fee = calculate_delivery_fee(calculated_distance_km, subtotal)
'''

new = '''    delivery_fee = calculate_delivery_fee(distance_km, subtotal)
'''

if old not in text:
    print("Target line not found. No changes made.")
else:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    print("Delivery fee calculation fixed successfully.")
