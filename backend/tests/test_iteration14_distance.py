"""Iteration 14 — Distance-based delivery fee + regression sanity.

Modules covered:
- POST /api/orders with distance_km (near ₹13 / far ₹20), free delivery >= ₹499
- Coupon apply regression, variants price resolution regression
- WhatsApp notify events regression
- Vendor/admin route sanity (analytics, settings, products)
"""
import os
import time
import uuid

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
TS = int(time.time())
UID = uuid.uuid4().hex[:8]

ADDRESS = {
    "full_name": "TEST It14 Cust",
    "phone": "9876512345",
    "line1": "Flat 4, Green Residency",
    "landmark": "Near Temple",
    "area": "Station Road",
    "city": "Ambajogai",
    "pincode": "431517",
}


CATEGORY_SLUG = None


def _resolve_category():
    global CATEGORY_SLUG
    if CATEGORY_SLUG is None:
        r = requests.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200, r.text[:200]
        CATEGORY_SLUG = r.json()[0]["slug"]
    return CATEGORY_SLUG


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:300]}"
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    return login(**ADMIN)["token"]


@pytest.fixture(scope="module")
def customer():
    email = f"TEST_it14_{TS}_{UID}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "TEST It14", "email": email, "password": "Cust@123", "phone": "9876512345"}, timeout=30)
    assert r.status_code in (200, 201), r.text[:300]
    return r.json()


@pytest.fixture(scope="module")
def cheap_product(admin_token):
    """A low-priced product so subtotal stays under the ₹499 free-delivery threshold."""
    _resolve_category()
    payload = {
        "name": f"TEST It14 Cheap {TS} {UID}",
        "slug": f"test-it14-cheap-{TS}-{UID}",
        "description": "test product",
        "price": 50,
        "unit": "1 pc",
        "category_slug": CATEGORY_SLUG or _resolve_category(),
        "image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "stock": 500,
    }
    r = requests.post(f"{API}/products", json=payload, headers=H(admin_token), timeout=30)
    assert r.status_code in (200, 201), f"create product failed: {r.status_code} {r.text[:400]}"
    return r.json()


def item_payload(product, qty):
    return {
        "product_id": product["id"],
        "name": product["name"],
        "price": product["price"],
        "quantity": qty,
        "image": product["image"],
        "unit": product["unit"],
    }


def place_order(token, product, qty, distance=None, coupon=None):
    body = {
        "items": [item_payload(product, qty)],
        "address": ADDRESS,
        "payment_method": "COD",
        "notes": "test",
    }
    if distance is not None:
        body["distance_km"] = distance
    if coupon:
        body["coupon_code"] = coupon
    return requests.post(f"{API}/orders", json=body, headers=H(token), timeout=40)


# ---------------- Distance-based delivery ----------------
class TestDistanceDelivery:
    def test_near_distance_fee_13(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 2, distance=1.0)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d["subtotal"] == 100, d["subtotal"]
        assert d["delivery_fee"] == 13, f"expected 13 got {d['delivery_fee']}"
        assert d["total"] == 113, d["total"]
        # persistence
        g = requests.get(f"{API}/orders/{d['id']}", headers=H(customer["token"]), timeout=30)
        assert g.status_code == 200
        assert g.json()["delivery_fee"] == 13

    def test_boundary_1_5_km_is_near(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 1, distance=1.5)
        assert r.status_code in (200, 201), r.text[:300]
        assert r.json()["delivery_fee"] == 13

    def test_far_distance_fee_20(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 2, distance=3.0)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d["delivery_fee"] == 20, f"expected 20 got {d['delivery_fee']}"
        assert d["total"] == 120, d["total"]

    def test_omitted_distance_defaults_near(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 1, distance=None)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        assert r.json()["delivery_fee"] == 13

    def test_null_distance_defaults_near(self, customer, cheap_product):
        body = {
            "items": [item_payload(cheap_product, 1)],
            "address": ADDRESS, "payment_method": "COD", "distance_km": None,
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=40)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        assert r.json()["delivery_fee"] == 13

    def test_free_delivery_above_threshold_far(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 10, distance=3.0)  # 500 subtotal
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()
        assert d["subtotal"] >= 499
        assert d["delivery_fee"] == 0, d["delivery_fee"]

    def test_free_delivery_above_threshold_near(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 10, distance=1.0)
        assert r.status_code in (200, 201), r.text[:300]
        assert r.json()["delivery_fee"] == 0


# ---------------- Regression sanity ----------------
class TestRegression:
    def test_coupon_apply_endpoint(self, admin_token, customer):
        code = f"TEST14{UID}"
        r = requests.post(f"{API}/admin/coupons", json={
            "code": code, "discount_pct": 10, "min_amount": 50, "active": True}, headers=H(admin_token), timeout=30)
        assert r.status_code in (200, 201), f"coupon create: {r.status_code} {r.text[:300]}"
        v = requests.get(f"{API}/coupons/{code}/validate?subtotal=100",
                         headers=H(customer["token"]), timeout=30)
        assert v.status_code == 200, f"{v.status_code} {v.text[:300]}"
        assert v.json()["discount"] == 10, v.json()

    def test_order_with_coupon_and_distance(self, customer, cheap_product, admin_token):
        code = f"TEST14B{UID}"
        requests.post(f"{API}/admin/coupons", json={"code": code, "discount_pct": 10, "min_amount": 50, "active": True},
                      headers=H(admin_token), timeout=30)
        r = place_order(customer["token"], cheap_product, 2, distance=3.0, coupon=code)
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()
        assert d["discount"] == 10, d
        assert d["delivery_fee"] == 20
        assert d["total"] == 110, d["total"]

    def test_variant_price_resolution(self, admin_token, customer):
        _resolve_category()
        payload = {
            "name": f"TEST It14 Variant {TS} {UID}", "slug": f"test-it14-variant-{TS}-{UID}",
            "description": "v", "price": 100, "unit": "500 g",
            "category_slug": CATEGORY_SLUG or _resolve_category(), "image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "stock": 100,
            "variants": [{"label": "500 g", "price": 100, "unit": "500 g"},
                         {"label": "1 kg", "price": 180, "unit": "1 kg"}],
        }
        c = requests.post(f"{API}/products", json=payload, headers=H(admin_token), timeout=30)
        assert c.status_code in (200, 201), c.text[:300]
        prod = c.json()
        assert len(prod.get("variants") or []) == 2
        body = {
            "items": [dict(item_payload(prod, 1), variant_label="1 kg")],
            "address": ADDRESS, "payment_method": "COD", "distance_km": 1.0,
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=40)
        assert r.status_code in (200, 201), r.text[:400]
        d = r.json()
        assert d["items"][0]["price"] == 180, d["items"][0]
        assert d["delivery_fee"] == 13
        requests.delete(f"{API}/products/{prod['id']}", headers=H(admin_token), timeout=30)

    def test_whatsapp_notify_events(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 1, distance=1.0)
        oid = r.json()["id"]
        for event in ("placed", "feedback"):
            n = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid, "event": event},
                              headers=H(customer["token"]), timeout=30)
            assert n.status_code == 200, f"{event}: {n.status_code} {n.text[:300]}"
            assert n.json()["url"].startswith("https://wa.me/"), n.json()

    def test_vendor_pages_apis(self):
        vt = login(**VENDOR)["token"]
        for path in ("/vendor/dashboard", "/vendor/analytics", "/vendors/me", "/vendor/settings", "/vendor/products", "/vendor/orders"):
            r = requests.get(f"{API}{path}", headers=H(vt), timeout=30)
            assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"

    def test_no_mongo_id_leak(self, customer, cheap_product):
        r = place_order(customer["token"], cheap_product, 1, distance=1.0)
        assert "_id" not in r.json()


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token, cheap_product):
    yield
    requests.delete(f"{API}/products/{cheap_product['id']}", headers=H(admin_token), timeout=30)
