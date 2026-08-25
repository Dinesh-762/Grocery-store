from pathlib import Path

path = Path("backend/server.py")
text = path.read_text(encoding="utf-8")

if "def calculate_delivery_fee(" in text:
    print("calculate_delivery_fee already exists. No changes made.")
else:
    marker = "FREE_DELIVERY_THRESHOLD = 499.0"

    function = '''

def calculate_delivery_fee(distance_km: float, subtotal: float = 0.0) -> float:
    """
    Calculate delivery charge from actual GPS distance.

    Pricing:
      0-1.0 km       -> minimum ?12
      1.0-1.5 km     -> smoothly increases ?12 -> ?15
      >1.5 km        -> ?12 per km

    Orders >= ?499 remain free as before.
    """
    distance = max(0.0, float(distance_km or 0.0))
    subtotal_value = max(0.0, float(subtotal or 0.0))

    if subtotal_value >= FREE_DELIVERY_THRESHOLD:
        return 0.0

    if distance <= 1.0:
        fee = 12.0
    elif distance <= 1.5:
        # 1 km = ?12 and 1.5 km = ?15
        fee = 12.0 + ((distance - 1.0) * 6.0)
    else:
        # 2 km = ?24, 3 km = ?36, etc.
        fee = distance * 12.0

    return round(fee, 2)
'''

    if marker not in text:
        print("ERROR: Pricing marker not found. No changes made.")
    else:
        text = text.replace(marker, marker + function, 1)

        # Keep the pricing constants consistent with the new formula.
        text = text.replace(
            "DELIVERY_RATE_PER_KM = 12\nDELIVERY_RATE_ABOVE_1_5_KM = 15",
            "DELIVERY_RATE_PER_KM = 12\nDELIVERY_RATE_ABOVE_1_5_KM = 12",
            1,
        )

        path.write_text(text, encoding="utf-8")
        print("Delivery pricing function added successfully.")
