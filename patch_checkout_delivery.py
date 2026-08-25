from pathlib import Path

path = Path("frontend/src/pages/Checkout.jsx")
text = path.read_text(encoding="utf-8")

old = '''  if (
    distanceKm <= 1.5
  ) {
    return (
      Math.round(
        distanceKm *
          DELIVERY_RATE_PER_KM *
          100
      ) / 100
    );
  }

  return (
    Math.round(
      distanceKm *
        DELIVERY_RATE_ABOVE_1_5_KM *
        100
    ) / 100
  );'''

new = '''  if (distanceKm <= 1.5) {
    if (distanceKm <= 1) {
      return Math.round(
        distanceKm * DELIVERY_RATE_PER_KM * 100
      ) / 100;
    }

    // 1 km = ?12, 1.5 km = ?15
    // Smoothly scale from ?12 at 1 km to ?15 at 1.5 km.
    return Math.round(
      distanceKm * 10 * 100
    ) / 100;
  }

  // Above 1.5 km: ?12 per km
  return Math.round(
    distanceKm * DELIVERY_RATE_PER_KM * 100
  ) / 100;'''

if old not in text:
    print("ERROR: Existing delivery calculation block not found.")
else:
    text = text.replace(old, new, 1)

    # Make frontend rates match backend.
    text = text.replace(
        "const DELIVERY_RATE_PER_KM = 13;",
        "const DELIVERY_RATE_PER_KM = 12;",
        1
    )

    text = text.replace(
        "const DELIVERY_RATE_ABOVE_1_5_KM = 20;",
        "const DELIVERY_RATE_ABOVE_1_5_KM = 12;",
        1
    )

    path.write_text(text, encoding="utf-8")
    print("Checkout delivery pricing updated successfully.")
