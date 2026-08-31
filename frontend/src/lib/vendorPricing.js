/** Vendor-facing amounts — base price only, never customer selling price. */

export function vendorLineUnitPrice(item) {
  if (item?.base_price != null) return Number(item.base_price);
  if (item?.line_total != null && item?.quantity) {
    return Number(item.line_total) / Number(item.quantity);
  }
  return Number(item?.price ?? 0);
}

export function vendorLineTotal(item) {
  if (item?.line_total != null) return Number(item.line_total);
  const qty = Number(item?.quantity ?? 0);
  return Math.round(vendorLineUnitPrice(item) * qty * 100) / 100;
}

export function vendorOrderTotal(items = []) {
  return Math.round(items.reduce((sum, it) => sum + vendorLineTotal(it), 0) * 100) / 100;
}
