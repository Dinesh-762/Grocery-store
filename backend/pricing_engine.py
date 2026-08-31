"""Centralized pricing engine — vendor base price + admin markup rules."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

DEFAULT_GLOBAL_MARKUP_PCT = 20.0
DEFAULT_GST_RATE = 0.05
DEFAULT_CGST_RATE = 0.025
DEFAULT_SGST_RATE = 0.025
DEFAULT_PLATFORM_FEE = 10.0
DEFAULT_FREE_DELIVERY_THRESHOLD = 499.0
DEFAULT_DELIVERY_NEAR_KM = 1.5
DEFAULT_DELIVERY_NEAR_FEE = 15.0
DEFAULT_DELIVERY_PER_KM = 12.0

RULE_TYPE_PRIORITY = {
    "product": 1,
    "vendor": 2,
    "subcategory": 3,
    "category": 4,
    "global": 5,
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_base_price(product: dict, variant_label: Optional[str] = None) -> float:
    if variant_label and product.get("variants"):
        for v in product["variants"]:
            if v.get("label") == variant_label:
                return float(v.get("base_price") or v.get("price") or 0)
    return float(product.get("base_price") or product.get("price") or 0)


def default_platform_settings() -> dict:
    return {
        "_id": "default",
        "global_markup_pct": DEFAULT_GLOBAL_MARKUP_PCT,
        "gst_rate": DEFAULT_GST_RATE,
        "cgst_rate": DEFAULT_CGST_RATE,
        "sgst_rate": DEFAULT_SGST_RATE,
        "tax_inclusive": False,
        "platform_fee": DEFAULT_PLATFORM_FEE,
        "free_delivery_threshold": DEFAULT_FREE_DELIVERY_THRESHOLD,
        "delivery_near_km": DEFAULT_DELIVERY_NEAR_KM,
        "delivery_near_fee": DEFAULT_DELIVERY_NEAR_FEE,
        "delivery_per_km": DEFAULT_DELIVERY_PER_KM,
        "min_payout_amount": 500.0,
        "settlement_days": 7,
        "referral_reward_amount": 500.0,
        "product_approval_required": True,
    }


async def get_platform_settings(db) -> dict:
    doc = await db.platform_settings.find_one({"_id": "default"})
    if not doc:
        return default_platform_settings()
    merged = default_platform_settings()
    merged.update({k: v for k, v in doc.items() if k != "_id"})
    return merged


async def get_active_pricing_rules(db) -> list[dict]:
    now = now_utc()
    rules = await db.pricing_rules.find({"active": True}).to_list(500)
    active = []
    for r in rules:
        start = r.get("start_date")
        end = r.get("end_date")
        try:
            if start and datetime.fromisoformat(start) > now:
                continue
            if end and datetime.fromisoformat(end) < now:
                continue
        except (TypeError, ValueError):
            pass
        active.append(r)
    active.sort(key=lambda x: RULE_TYPE_PRIORITY.get(x.get("rule_type", "global"), 99))
    return active


def resolve_markup_pct(
    product: dict,
    rules: list[dict],
    settings: dict,
) -> tuple[float, str]:
    """Return (markup_pct, rule_source). Highest-priority matching rule wins."""
    pid = str(product.get("_id", product.get("id", "")))
    vid = product.get("vendor_id") or ""
    cat = product.get("category_slug") or ""
    subcat = product.get("subcategory_slug") or ""

    for rule in rules:
        rt = rule.get("rule_type", "global")
        target = rule.get("target_id") or ""
        if rt == "product" and target == pid:
            return float(rule.get("markup_pct", settings["global_markup_pct"])), f"product:{target}"
        if rt == "vendor" and target == vid:
            return float(rule.get("markup_pct", settings["global_markup_pct"])), f"vendor:{target}"
        if rt == "subcategory" and target == subcat and subcat:
            return float(rule.get("markup_pct", settings["global_markup_pct"])), f"subcategory:{target}"
        if rt == "category" and target == cat:
            return float(rule.get("markup_pct", settings["global_markup_pct"])), f"category:{target}"
        if rt == "global":
            return float(rule.get("markup_pct", settings["global_markup_pct"])), "global"

    return float(settings.get("global_markup_pct", DEFAULT_GLOBAL_MARKUP_PCT)), "global_default"


def apply_markup(base_price: float, markup_pct: float) -> dict:
    base = round(max(0.0, float(base_price)), 2)
    markup_amount = round(base * markup_pct / 100.0, 2)
    selling = round(base + markup_amount, 2)
    return {
        "base_price": base,
        "markup_pct": markup_pct,
        "markup_amount": markup_amount,
        "selling_price": selling,
    }


async def compute_product_price(
    db,
    product: dict,
    variant_label: Optional[str] = None,
    settings: Optional[dict] = None,
    rules: Optional[list[dict]] = None,
) -> dict:
    if settings is None:
        settings = await get_platform_settings(db)
    if rules is None:
        rules = await get_active_pricing_rules(db)

    base = get_base_price(product, variant_label)
    markup_pct, rule_source = resolve_markup_pct(product, rules, settings)
    result = apply_markup(base, markup_pct)
    result["rule_source"] = rule_source

    # Category/product-specific GST override
    gst_rate = float(settings.get("gst_rate", DEFAULT_GST_RATE))
    for rule in rules:
        if rule.get("rule_type") == "gst_category" and rule.get("target_id") == product.get("category_slug"):
            gst_rate = float(rule.get("gst_rate", gst_rate))
            break
    result["gst_rate"] = gst_rate
    return result


async def enrich_product_for_customer(db, product: dict, settings=None, rules=None) -> dict:
    """Add computed customer-facing prices to product dict."""
    pricing = await compute_product_price(db, product, settings=settings, rules=rules)
    out = dict(product)
    out["base_price"] = pricing["base_price"]
    out["price"] = pricing["selling_price"]
    out["markup_pct"] = pricing["markup_pct"]
    out["markup_amount"] = pricing["markup_amount"]

    if out.get("mrp") and out["mrp"] < out["price"]:
        out["mrp"] = round(out["price"] * 1.1, 2)

    variants = []
    for v in product.get("variants") or []:
        vp = await compute_product_price(db, product, variant_label=v.get("label"), settings=settings, rules=rules)
        variants.append({
            **v,
            "base_price": vp["base_price"],
            "price": vp["selling_price"],
        })
    out["variants"] = variants
    return out


def compute_delivery_fee_from_settings(settings: dict, distance_km: float, subtotal: float) -> float:
    threshold = float(settings.get("free_delivery_threshold", DEFAULT_FREE_DELIVERY_THRESHOLD))
    if subtotal >= threshold:
        return 0.0
    near_km = float(settings.get("delivery_near_km", DEFAULT_DELIVERY_NEAR_KM))
    near_fee = float(settings.get("delivery_near_fee", DEFAULT_DELIVERY_NEAR_FEE))
    per_km = float(settings.get("delivery_per_km", DEFAULT_DELIVERY_PER_KM))
    d = max(0.0, float(distance_km or 0))
    if d <= near_km:
        return near_fee
    return round(near_fee + ((d - near_km) * per_km), 2)


def compute_order_totals(
    settings: dict,
    subtotal: float,
    distance_km: float,
    discount: float = 0.0,
) -> dict:
    delivery_fee = compute_delivery_fee_from_settings(settings, distance_km, subtotal)
    taxable_subtotal = round(max(0, subtotal - discount), 2)
    platform_fee = float(settings.get("platform_fee", DEFAULT_PLATFORM_FEE)) if taxable_subtotal > 0 else 0.0
    taxable_amount = round(taxable_subtotal + platform_fee + delivery_fee, 2)
    cgst_rate = float(settings.get("cgst_rate", DEFAULT_CGST_RATE))
    sgst_rate = float(settings.get("sgst_rate", DEFAULT_SGST_RATE))
    cgst = round(taxable_amount * cgst_rate, 2)
    sgst = round(taxable_amount * sgst_rate, 2)
    gst = round(cgst + sgst, 2)
    total = round(max(0, taxable_amount + gst), 2)
    return {
        "subtotal": subtotal,
        "discount": discount,
        "delivery_fee": delivery_fee,
        "platform_fee": platform_fee,
        "taxable_amount": taxable_amount,
        "cgst": cgst,
        "sgst": sgst,
        "gst": gst,
        "total": total,
    }


def get_order_item_base_price(item: dict) -> float:
    """Vendor payout unit price from an order line (never customer selling price)."""
    snap = item.get("pricing_snapshot") or {}
    base = snap.get("base_price")
    if base is not None:
        return float(base)
    if item.get("base_price") is not None:
        return float(item["base_price"])
    # Legacy orders may only have a single price field.
    return float(item.get("price") or 0)


def vendor_order_item_out(item: dict) -> dict:
    """Vendor-facing order line — base price only; markup/tax hidden."""
    base = get_order_item_base_price(item)
    qty = int(item.get("quantity") or 0)
    return {
        "product_id": item.get("product_id"),
        "name": item.get("name"),
        "quantity": qty,
        "unit": item.get("unit"),
        "image": item.get("image"),
        "variant_label": item.get("variant_label"),
        "note": item.get("note"),
        "line_status": item.get("line_status"),
        "vendor_id": item.get("vendor_id"),
        "base_price": base,
        "price": base,
        "line_total": round(base * qty, 2),
    }


def product_to_vendor_out(p: dict) -> dict:
    """Vendor sees base prices only."""
    variants = []
    for v in p.get("variants") or []:
        bp = float(v.get("base_price") or v.get("price") or 0)
        variants.append({**v, "base_price": bp, "price": bp})
    base = get_base_price(p)
    return {
        "id": str(p["_id"]),
        "name": p["name"],
        "slug": p["slug"],
        "description": p.get("description", ""),
        "base_price": base,
        "price": base,
        "mrp": p.get("mrp"),
        "unit": p.get("unit", "1 pc"),
        "category_slug": p["category_slug"],
        "subcategory_slug": p.get("subcategory_slug"),
        "image": p["image"],
        "images": p.get("images") or [p["image"]] if p.get("image") else [],
        "stock": p.get("stock", 0),
        "low_stock_threshold": p.get("low_stock_threshold", 5),
        "sku": p.get("sku", ""),
        "weight": p.get("weight"),
        "dimensions": p.get("dimensions"),
        "min_order_qty": p.get("min_order_qty", 1),
        "product_status": p.get("product_status", "active"),
        "featured": p.get("featured", False),
        "popular": p.get("popular", False),
        "created_at": p.get("created_at", ""),
        "vendor_id": p.get("vendor_id"),
        "vendor_name": p.get("vendor_name"),
        "approval_status": p.get("approval_status", "approved"),
        "variants": variants,
    }
