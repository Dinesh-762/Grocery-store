"""Iteration 9 — Vendor Business Center + Analytics
Covers: GET/PATCH /api/vendor/settings, GET /api/vendor/analytics,
order enforcement (vacation_mode, open_now, min_order_amount),
public storefront new fields.
"""
import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@ambajogai.com", "password": "Admin@123"}
VENDOR = {"email": "test_vendor_ui_1785253172@example.com", "password": "Vendor@123"}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:300]}"
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def vendor_token():
    return login(VENDOR["email"], VENDOR["password"])


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN["email"], ADMIN["password"])


@pytest.fixture(scope="module")
def customer():
    ts = int(time.time())
    payload = {"name": "TEST It9 Cust", "email": f"TEST_it9_{ts}@example.com", "password": "Test@123", "phone": "9876500011"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text[:300]
    return {"token": r.json()["token"], "email": payload["email"]}


@pytest.fixture(scope="module")
def vendor_id(vendor_token):
    r = requests.get(f"{API}/vendors/me", headers=H(vendor_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    return r.json()["id"]


@pytest.fixture(scope="module")
def vendor_product(vendor_token):
    r = requests.get(f"{API}/vendor/products", headers=H(vendor_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    prods = [p for p in r.json() if p.get("approved") is not False and p.get("stock", 0) > 5]
    if not prods:
        prods = r.json()
    assert prods, "vendor has no products to test with"
    return prods[0]


def patch_settings(token, body, expect=200):
    r = requests.patch(f"{API}/vendor/settings", json=body, headers=H(token), timeout=30)
    assert r.status_code == expect, f"PATCH settings {body} -> {r.status_code} {r.text[:300]}"
    return r


@pytest.fixture(scope="module", autouse=True)
def restore_state(vendor_token):
    """Always restore vendor to a sane orderable state at end of module."""
    yield
    requests.patch(f"{API}/vendor/settings", json={
        "vacation_mode": False, "open_now": True, "min_order_amount": 100,
        "delivery_radius_km": 5, "estimated_delivery_min": 45, "vacation_message": "",
    }, headers=H(vendor_token), timeout=30)


# ---------------- AUTH & RBAC ----------------
class TestAuthRbac:
    def test_settings_requires_auth(self):
        r = requests.get(f"{API}/vendor/settings", timeout=30)
        assert r.status_code in (401, 403), r.status_code
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_analytics_requires_auth(self):
        r = requests.get(f"{API}/vendor/analytics", timeout=30)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_customer_token_forbidden(self, customer):
        for ep in ("/vendor/settings", "/vendor/analytics"):
            r = requests.get(f"{API}{ep}", headers=H(customer["token"]), timeout=30)
            assert r.status_code == 403, f"{ep} -> {r.status_code} {r.text[:200]}"
            assert "Vendor access required" in r.text

    def test_admin_token_forbidden(self, admin_token):
        r = requests.get(f"{API}/vendor/settings", headers=H(admin_token), timeout=30)
        assert r.status_code == 403

    def test_bad_token_401(self):
        r = requests.get(f"{API}/vendor/settings", headers=H("garbage.token.value"), timeout=30)
        assert r.status_code == 401

    def test_approved_vendor_200(self, vendor_token):
        for ep in ("/vendor/settings", "/vendor/analytics"):
            r = requests.get(f"{API}{ep}", headers=H(vendor_token), timeout=30)
            assert r.status_code == 200, f"{ep} -> {r.status_code} {r.text[:200]}"
            assert '"_id"' not in r.text


# ---------------- SHOP SETTINGS ----------------
class TestShopSettings:
    def test_get_settings_shape(self, vendor_token):
        r = requests.get(f"{API}/vendor/settings", headers=H(vendor_token), timeout=30)
        d = r.json()
        for k in ["id", "business_name", "status", "shop_phone", "shop_whatsapp", "shop_logo",
                  "banner_image", "business_hours", "open_now", "vacation_mode", "vacation_message",
                  "delivery_radius_km", "min_order_amount", "estimated_delivery_min"]:
            assert k in d, f"missing key {k}"
        assert d["status"] == "Approved"

    def test_patch_persists_all_fields(self, vendor_token):
        body = {
            "shop_phone": "9123456780",
            "shop_whatsapp": "9123456781",
            "shop_logo": "https://res.cloudinary.com/demo/image/upload/logo9.png",
            "banner_image": "https://res.cloudinary.com/demo/image/upload/banner9.png",
            "business_hours": {"mon": "09:00-21:00", "tue": "09:00-21:00", "wed": "10:00-20:00",
                               "thu": "10:00-20:00", "fri": "09:30-22:00", "sat": "08:00-23:00", "sun": "Closed"},
            "open_now": True,
            "vacation_mode": False,
            "vacation_message": "TEST back on Monday",
            "delivery_radius_km": 7.5,
            "min_order_amount": 100,
            "estimated_delivery_min": 40,
        }
        resp = patch_settings(vendor_token, body).json()
        # response reflects change
        for k, v in body.items():
            assert resp[k] == v, f"PATCH response {k}={resp[k]!r} expected {v!r}"
        # GET verifies persistence
        got = requests.get(f"{API}/vendor/settings", headers=H(vendor_token), timeout=30).json()
        for k, v in body.items():
            assert got[k] == v, f"persisted {k}={got[k]!r} expected {v!r}"
        assert got["business_hours"]["sun"] == "Closed"

    @pytest.mark.parametrize("body,field", [
        ({"min_order_amount": -5}, "min_order_amount"),
        ({"delivery_radius_km": -1}, "delivery_radius_km"),
        ({"estimated_delivery_min": -1}, "estimated_delivery_min"),
    ])
    def test_negative_values_rejected(self, vendor_token, body, field):
        r = requests.patch(f"{API}/vendor/settings", json=body, headers=H(vendor_token), timeout=30)
        assert r.status_code == 400, f"{field} negative accepted! -> {r.status_code} {r.text[:200]}"

    def test_empty_patch_is_noop(self, vendor_token):
        r = requests.patch(f"{API}/vendor/settings", json={}, headers=H(vendor_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "Approved"


# ---------------- PUBLIC STOREFRONT ----------------
class TestPublicStorefront:
    def test_storefront_exposes_new_fields(self, vendor_id):
        r = requests.get(f"{API}/vendors/{vendor_id}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        v = d.get("vendor", d)
        for k in ["shop_logo", "banner_image", "business_hours", "open_now", "vacation_mode",
                  "vacation_message", "shop_phone", "shop_whatsapp", "delivery_radius_km",
                  "min_order_amount", "estimated_delivery_min", "verified"]:
            assert k in v, f"storefront missing {k}. keys={list(v.keys())}"
        assert v["verified"] is True
        assert v["shop_phone"] == "9123456780"
        assert '"_id"' not in r.text

    def test_legacy_vendor_defaults(self):
        """Any other approved vendor without settings should still get sane defaults."""
        r = requests.get(f"{API}/vendors", timeout=30)
        assert r.status_code == 200
        vendors = r.json()
        assert isinstance(vendors, list)
        for v in vendors[:5]:
            d = requests.get(f"{API}/vendors/{v['id']}", timeout=30).json()
            vv = d.get("vendor", d)
            assert isinstance(vv.get("open_now"), bool)
            assert isinstance(vv.get("vacation_mode"), bool)
            assert vv.get("min_order_amount") is not None
            assert vv.get("verified") is True


# ---------------- ORDER ENFORCEMENT ----------------
def order_payload(prod, qty=1):
    return {
        "items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"],
                   "quantity": qty, "image": prod["image"], "unit": prod.get("unit", "1 pc")}],
        "address": {"full_name": "TEST It9", "phone": "9876500011", "line1": "1 Test Road",
                    "area": "Test Area", "city": "Ambajogai", "pincode": "431517"},
        "payment_method": "COD",
    }


class TestOrderEnforcement:
    def test_vacation_mode_blocks_order(self, vendor_token, customer, vendor_product):
        patch_settings(vendor_token, {"vacation_mode": True, "min_order_amount": 0})
        r = requests.post(f"{API}/orders", json=order_payload(vendor_product),
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 400, f"vacation not enforced -> {r.status_code} {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "temporarily closed" in detail.lower(), detail
        # vendor identified in message
        assert detail.split(" is ")[0].strip() != "", detail
        # restore
        patch_settings(vendor_token, {"vacation_mode": False})
        r2 = requests.post(f"{API}/orders", json=order_payload(vendor_product),
                           headers=H(customer["token"]), timeout=30)
        assert r2.status_code in (200, 201), f"order blocked after restore: {r2.status_code} {r2.text[:300]}"

    def test_open_now_false_blocks_order(self, vendor_token, customer, vendor_product):
        patch_settings(vendor_token, {"open_now": False, "vacation_mode": False, "min_order_amount": 0})
        r = requests.post(f"{API}/orders", json=order_payload(vendor_product),
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 400, f"open_now not enforced -> {r.status_code}"
        assert "not accepting orders right now" in r.json().get("detail", "").lower()
        patch_settings(vendor_token, {"open_now": True})

    def test_min_order_amount_enforced(self, vendor_token, customer, vendor_product):
        patch_settings(vendor_token, {"min_order_amount": 500, "open_now": True, "vacation_mode": False})
        r = requests.post(f"{API}/orders", json=order_payload(vendor_product, 1),
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 400, f"min order not enforced -> {r.status_code} {r.text[:300]}"
        assert "minimum order" in r.json().get("detail", "").lower()
        # now go above the minimum
        qty = int(500 // vendor_product["price"]) + 1
        if vendor_product.get("stock", 0) >= qty:
            r2 = requests.post(f"{API}/orders", json=order_payload(vendor_product, qty),
                               headers=H(customer["token"]), timeout=30)
            assert r2.status_code in (200, 201), f"order above min rejected: {r2.status_code} {r2.text[:300]}"
            assert r2.json()["subtotal"] >= 500
        patch_settings(vendor_token, {"min_order_amount": 100})


# ---------------- ANALYTICS ----------------
class TestAnalytics:
    def test_analytics_shape(self, vendor_token):
        d = requests.get(f"{API}/vendor/analytics", headers=H(vendor_token), timeout=30).json()
        for k in ["today_orders", "week_orders", "month_revenue", "total_revenue",
                  "total_items_sold", "best_sellers", "recent_orders", "low_stock"]:
            assert k in d, f"analytics missing {k}"
        assert isinstance(d["best_sellers"], list)
        assert isinstance(d["recent_orders"], list) and len(d["recent_orders"]) <= 10
        assert isinstance(d["today_orders"], int) and d["today_orders"] >= 0
        assert isinstance(d["week_orders"], int)

    def test_delivered_order_updates_revenue_and_best_sellers(self, vendor_token, customer, vendor_product):
        patch_settings(vendor_token, {"min_order_amount": 0, "open_now": True, "vacation_mode": False})
        before = requests.get(f"{API}/vendor/analytics", headers=H(vendor_token), timeout=30).json()

        qty = 2
        r = requests.post(f"{API}/orders", json=order_payload(vendor_product, qty),
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        order_id = r.json()["id"]

        lr = requests.patch(f"{API}/vendor/orders/{order_id}/line-status", json={"status": "Delivered"},
                            headers=H(vendor_token), timeout=30)
        assert lr.status_code == 200, lr.text[:300]

        after = requests.get(f"{API}/vendor/analytics", headers=H(vendor_token), timeout=30).json()
        expected_delta = round(vendor_product["price"] * qty, 2)
        assert after["total_revenue"] == pytest.approx(before["total_revenue"] + expected_delta, abs=0.05), \
            f"revenue {before['total_revenue']} -> {after['total_revenue']}, expected +{expected_delta}"
        assert after["total_items_sold"] == before["total_items_sold"] + qty
        assert after["month_revenue"] >= expected_delta
        names = [b["product_id"] for b in after["best_sellers"]]
        assert vendor_product["id"] in names, f"product missing from best_sellers: {after['best_sellers']}"
        bs = [b for b in after["best_sellers"] if b["product_id"] == vendor_product["id"]][0]
        for k in ["product_id", "name", "image", "unit", "qty", "revenue"]:
            assert k in bs, f"best_seller missing {k}"
        assert bs["qty"] >= qty
        assert after["recent_orders"][0]["id"] == order_id
        assert after["recent_orders"][0]["my_subtotal"] == pytest.approx(expected_delta, abs=0.05)
        patch_settings(vendor_token, {"min_order_amount": 100})


# ---------------- REGRESSION SANITY ----------------
class TestRegression:
    def test_vendor_dashboard_still_works(self, vendor_token):
        r = requests.get(f"{API}/vendor/dashboard", headers=H(vendor_token), timeout=30)
        assert r.status_code == 200
        assert "vendor" in r.json()

    def test_public_lists(self):
        for ep in ("/products", "/categories", "/vendors", "/store/info"):
            r = requests.get(f"{API}{ep}", timeout=30)
            assert r.status_code == 200, f"{ep} -> {r.status_code}"

    def test_admin_orders_and_status_update(self, admin_token):
        r = requests.get(f"{API}/admin/orders", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list) and orders
        oid = orders[0]["id"]
        cur = orders[0]["status"]
        u = requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": cur},
                           headers=H(admin_token), timeout=30)
        assert u.status_code == 200, u.text[:200]
