from pathlib import Path

path = Path("frontend/src/pages/Checkout.jsx")
text = path.read_text(encoding="utf-8")

start = text.index("function calculateDeliveryFee(")
end = text.index("\nexport default function Checkout()", start)

new_function = '''function calculateDeliveryFee(
  distanceKm,
  subtotal = 0
) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    return 0;
  }

  // Orders >= 499 get free delivery.
  if (Number(subtotal) >= 499) {
    return 0;
  }

  /*
   * Delivery pricing:
   *
   * 1 km   = 12
   * 1.5 km = 15
   * 2 km   = 24
   * 3 km   = 36
   * 4 km   = 48
   *
   * At 1.5 km, minimum charge is 15.
   * Above 1.5 km, charge = distance x 12.
   */

  if (distanceKm <= 1) {
    return Math.round(
      distanceKm * DELIVERY_RATE_PER_KM * 100
    ) / 100;
  }

  if (distanceKm <= 1.5) {
    return 15;
  }

  return Math.round(
    distanceKm * DELIVERY_RATE_PER_KM * 100
  ) / 100;
}
'''

path.write_text(
    text[:start] + new_function + text[end:],
    encoding="utf-8"
)

print("Checkout delivery pricing fixed successfully.")
