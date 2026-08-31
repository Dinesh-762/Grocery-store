/** Delivery fee rules — synced with backend via /pricing/settings when available. */
export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_NEAR_KM = 1.5;
export const DELIVERY_NEAR_FEE = 15;
export const DELIVERY_PER_KM = 12;

let _pricingSettings = null;

export function setPricingSettings(settings) {
  _pricingSettings = settings;
}

export function getPricingSettings() {
  return _pricingSettings;
}

export function computeDeliveryFee(distanceKm, subtotal = 0) {
  const threshold = Number(_pricingSettings?.free_delivery_threshold ?? FREE_DELIVERY_THRESHOLD);
  const nearKm = Number(_pricingSettings?.delivery_near_km ?? DELIVERY_NEAR_KM);
  const nearFee = Number(_pricingSettings?.delivery_near_fee ?? DELIVERY_NEAR_FEE);
  const perKm = Number(_pricingSettings?.delivery_per_km ?? DELIVERY_PER_KM);

  if (Number(subtotal) >= threshold) {
    return 0;
  }

  const d = Math.max(0, Number(distanceKm) || 0);
  if (!Number.isFinite(d) || d <= 0) {
    return 0;
  }

  if (d <= nearKm) {
    return nearFee;
  }

  return Math.round((nearFee + (d - nearKm) * perKm) * 100) / 100;
}
