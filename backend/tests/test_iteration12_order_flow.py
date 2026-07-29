"""Iteration 12 — Product variants, custom notes, WhatsApp order notification templates.

Modules covered:
- POST/PUT /api/products (admin) with `variants`
- POST /api/vendor/products with `variants`
- GET /api/products/{slug} returns variants
- POST /api/orders variant resolution (server-side price authority) + item note
- POST /api/notify/order-whatsapp events: placed (itemised), feedback, RBAC
- Regression sanity: non-variant product order, coupon, tracker statuses
"""
import os
import time
import urllib.parse
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

ADDRESS = {
    "full_name": "TEST It12 Cust",
    "phone": "9876512345",
    "line1": "Flat 4, Green Residency",
    "landmark": "Near Yogeshwari Temple",
    "area": "Station Road",
    "city": "Ambajogai",
    "pincode": "431517",
}


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
def vendor_token():
    return login(**VENDOR)["token"]


@pytest.fixture(scope="module")
def customer():
    p = {"name": "TEST It12 Cust", "email": f"TEST_it12_{TS}@example.com",
         "password": "Test@123", "phone": "9876512345"}
    r = requests.post(f"{API}/auth/register", json=p, timeout=30)
    if r.status_code == 400 and "already" in r.text.lower():
        d = login(p["email"], p["password"])
    else:
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()
    return {"token": d["token"], "id": d["user"]["id"], "email": p["email"]}


@pytest.fixture(scope="module")
def category_slug():
    r = requests.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200, r.text[:300]
    cats = r.json()
    assert cats, "No categories seeded"
    return cats[0]["slug"]


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token, created_ids):
    yield
    for pid in created_ids:
        try:
            requests.delete(f"{API}/products/{pid}", headers=H(admin_token), timeout=30)
        except Exception:
            pass


def make_product(admin_token, created_ids, category_slug, suffix, variants=None, price=50.0):
    payload = {
        "name": f"TEST It12 Product {suffix}",
        "slug": f"test-it12-product-{suffix}-{TS}-{uuid.uuid4().hex[:6]}",
        "description": "Iteration 12 test product",
        "price": price,
        "mrp": price + 20,
        "unit": "500 g",
        "category_slug": category_slug,
        "image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "stock": 500,
    }
    if variants is not None:
        payload["variants"] = variants
    r = requests.post(f"{API}/products", json=payload, headers=H(admin_token), timeout=30)
    assert r.status_code in (200, 201), f"product create failed: {r.status_code} {r.text[:400]}"
    data = r.json()
    created_ids.append(data["id"])
    return data


# ---------------------------------------------------------------- variants CRUD
class TestVariantsProductApi:
    def test_admin_create_product_with_variants(self, admin_token, created_ids, category_slug):
        variants = [
            {"label": "500 g", "price": 60.0, "unit": "500 g"},
            {"label": "1 kg", "price": 110.0, "unit": "1 kg"},
        ]
        p = make_product(admin_token, created_ids, category_slug, "va", variants=variants)
        assert p["variants"] == variants, p["variants"]

        # GET by slug returns variants
        g = requests.get(f"{API}/products/{p['slug']}", timeout=30)
        assert g.status_code == 200, g.text[:300]
        gd = g.json()
        assert len(gd["variants"]) == 2
        assert gd["variants"][1]["label"] == "1 kg"
        assert gd["variants"][1]["price"] == 110.0

    def test_admin_update_product_variants(self, admin_token, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "vb",
                         variants=[{"label": "250 g", "price": 30.0, "unit": "250 g"}])
        new_variants = [
            {"label": "250 g", "price": 35.0, "unit": "250 g"},
            {"label": "2 kg", "price": 200.0, "unit": "2 kg"},
        ]
        upd = {
            "name": p["name"], "slug": p["slug"], "description": p["description"],
            "price": p["price"], "mrp": p["mrp"], "unit": p["unit"],
            "category_slug": p["category_slug"], "image": p["image"], "stock": p["stock"],
            "variants": new_variants,
        }
        r = requests.put(f"{API}/products/{p['id']}", json=upd, headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        assert r.json()["variants"] == new_variants

        g = requests.get(f"{API}/products/{p['slug']}", timeout=30)
        assert g.json()["variants"] == new_variants

    def test_product_without_variants_returns_empty_list(self, admin_token, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "novar")
        assert p["variants"] == []
        g = requests.get(f"{API}/products/{p['slug']}", timeout=30)
        assert g.json()["variants"] == []

    def test_vendor_create_product_with_variants(self, vendor_token, category_slug):
        variants = [{"label": "1 L", "price": 75.0, "unit": "1 L"}]
        payload = {
            "name": f"TEST It12 Vendor Prod {TS} {uuid.uuid4().hex[:4]}",
            "slug": f"test-it12-vendor-prod-{TS}-{uuid.uuid4().hex[:6]}",
            "description": "vendor variant product",
            "price": 75.0, "mrp": 90.0, "unit": "1 L",
            "category_slug": category_slug,
            "image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "stock": 50, "variants": variants,
        }
        r = requests.post(f"{API}/vendor/products", json=payload, headers=H(vendor_token), timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        assert r.json()["variants"] == variants


# ------------------------------------------------- order variant + note handling
class TestOrderVariantAndNote:
    def test_order_uses_db_variant_price_not_client_price(self, admin_token, customer, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "ord1",
                         variants=[{"label": "500 g", "price": 60.0, "unit": "500 g"},
                                   {"label": "1 kg", "price": 110.0, "unit": "1 kg"}], price=50.0)
        body = {
            "items": [{
                "product_id": p["id"], "name": p["name"], "price": 1,  # bogus client price
                "quantity": 2, "image": p["image"], "unit": "wrong",
                "variant_label": "1 kg", "note": "Please pack in paper bag",
            }],
            "address": ADDRESS, "payment_method": "COD", "notes": "TEST it12",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        o = r.json()
        it = o["items"][0]
        assert it["price"] == 110.0, f"variant price not server-resolved: {it}"
        assert it["unit"] == "1 kg", it
        assert it["variant_label"] == "1 kg"
        assert it["note"] == "Please pack in paper bag"
        assert o["subtotal"] == 220.0, o
        assert "_id" not in o

        # persistence via GET
        g = requests.get(f"{API}/orders/{o['id']}", headers=H(customer["token"]), timeout=30)
        assert g.status_code == 200, g.text[:300]
        gi = g.json()["items"][0]
        assert gi["price"] == 110.0 and gi["variant_label"] == "1 kg"
        assert gi["note"] == "Please pack in paper bag"

    def test_unknown_variant_label_rejected(self, admin_token, customer, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "ord2",
                         variants=[{"label": "500 g", "price": 60.0, "unit": "500 g"}])
        body = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": 60, "quantity": 1,
                       "image": p["image"], "unit": "500 g", "variant_label": "5 kg"}],
            "address": ADDRESS, "payment_method": "COD",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:300]}"
        assert "variant" in r.json().get("detail", "").lower()

    def test_two_variant_products_independent(self, admin_token, customer, created_ids, category_slug):
        p1 = make_product(admin_token, created_ids, category_slug, "ordA",
                          variants=[{"label": "S", "price": 20.0, "unit": "S"},
                                    {"label": "L", "price": 45.0, "unit": "L"}])
        p2 = make_product(admin_token, created_ids, category_slug, "ordB",
                          variants=[{"label": "Half", "price": 15.0, "unit": "half"},
                                    {"label": "Full", "price": 28.0, "unit": "full"}])
        body = {
            "items": [
                {"product_id": p1["id"], "name": p1["name"], "price": 9, "quantity": 1,
                 "image": p1["image"], "unit": "x", "variant_label": "L", "note": "note one"},
                {"product_id": p2["id"], "name": p2["name"], "price": 9, "quantity": 3,
                 "image": p2["image"], "unit": "x", "variant_label": "Half", "note": "note two"},
            ],
            "address": ADDRESS, "payment_method": "UPI",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        o = r.json()
        assert len(o["items"]) == 2
        assert o["items"][0]["price"] == 45.0 and o["items"][0]["note"] == "note one"
        assert o["items"][1]["price"] == 15.0 and o["items"][1]["note"] == "note two"
        assert o["subtotal"] == round(45.0 + 45.0, 2)

    def test_same_product_two_lines_different_variant_and_note(self, admin_token, customer, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "ordC",
                         variants=[{"label": "500 g", "price": 60.0, "unit": "500 g"},
                                   {"label": "1 kg", "price": 110.0, "unit": "1 kg"}])
        body = {
            "items": [
                {"product_id": p["id"], "name": p["name"], "price": 0, "quantity": 1,
                 "image": p["image"], "unit": "x", "variant_label": "500 g", "note": "less spicy"},
                {"product_id": p["id"], "name": p["name"], "price": 0, "quantity": 1,
                 "image": p["image"], "unit": "x", "variant_label": "1 kg", "note": "extra spicy"},
            ],
            "address": ADDRESS, "payment_method": "COD",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        items = r.json()["items"]
        assert len(items) == 2, "separate lines should be preserved"
        assert {i["variant_label"] for i in items} == {"500 g", "1 kg"}
        assert {i["note"] for i in items} == {"less spicy", "extra spicy"}

    def test_no_variant_product_order_unchanged(self, admin_token, customer, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "ordD", price=42.0)
        body = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": 1, "quantity": 2,
                       "image": p["image"], "unit": "x"}],
            "address": ADDRESS, "payment_method": "COD",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        it = r.json()["items"][0]
        assert it["price"] == 42.0 and it["unit"] == "500 g"
        assert it.get("variant_label") in (None, "")
        assert it.get("note") in (None, "")

    def test_blank_note_stored_as_null(self, admin_token, customer, created_ids, category_slug):
        p = make_product(admin_token, created_ids, category_slug, "ordE", price=25.0)
        body = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": 25, "quantity": 1,
                       "image": p["image"], "unit": "x", "note": "   "}],
            "address": ADDRESS, "payment_method": "COD",
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        assert r.json()["items"][0]["note"] is None


# ------------------------------------------------------ whatsapp notify events
@pytest.fixture(scope="module")
def variant_order(admin_token, customer, created_ids, category_slug):
    p = make_product(admin_token, created_ids, category_slug, "wa",
                     variants=[{"label": "1 kg", "price": 110.0, "unit": "1 kg"}])
    body = {
        "items": [{"product_id": p["id"], "name": p["name"], "price": 1, "quantity": 2,
                   "image": p["image"], "unit": "x", "variant_label": "1 kg",
                   "note": "ring the bell twice"}],
        "address": ADDRESS, "payment_method": "COD",
    }
    r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
    assert r.status_code in (200, 201), r.text[:400]
    return r.json()


class TestNotifyWhatsapp:
    def test_placed_template_itemised(self, customer, variant_order):
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": variant_order["id"], "event": "placed"},
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        msg = d["message"]
        assert "thank you for your order" in msg.lower()
        assert "(1 kg)" in msg, msg
        assert "x 2 @ ₹110.0" in msg or "x 2 @ ₹110" in msg, msg
        assert "Note: ring the bell twice" in msg
        assert f"Subtotal: ₹{variant_order['subtotal']}" in msg
        assert "Delivery:" in msg
        assert f"Total: ₹{variant_order['total']}" in msg
        assert "Payment: COD" in msg
        assert ADDRESS["line1"] in msg and ADDRESS["pincode"] in msg
        assert ADDRESS["landmark"] in msg
        assert "Estimated delivery: 30-45 minutes" in msg
        # URL correctness
        assert d["url"].startswith("https://wa.me/919876512345?text=")
        assert urllib.parse.unquote(d["url"].split("text=", 1)[1]) == msg

    def test_feedback_template(self, customer, variant_order):
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": variant_order["id"], "event": "feedback"},
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 200, r.text[:400]
        msg = r.json()["message"]
        assert "1-5" in msg
        assert str(variant_order["id"])[-6:].upper() in msg
        assert r.json()["url"].startswith("https://wa.me/919876512345?text=")

    def test_admin_can_notify_any_order(self, admin_token, variant_order):
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": variant_order["id"], "event": "feedback"},
                          headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_other_customer_forbidden(self, variant_order):
        p = {"name": "TEST It12 Other", "email": f"TEST_it12_other_{TS}@example.com",
             "password": "Test@123", "phone": "9876512399"}
        rr = requests.post(f"{API}/auth/register", json=p, timeout=30)
        if rr.status_code == 400 and "already" in rr.text.lower():
            tok = login(p["email"], p["password"])["token"]
        else:
            assert rr.status_code in (200, 201), rr.text[:300]
            tok = rr.json()["token"]
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": variant_order["id"], "event": "placed"},
                          headers=H(tok), timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"

    def test_missing_order_id_400(self, customer):
        r = requests.post(f"{API}/notify/order-whatsapp", json={"event": "placed"},
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 400

    def test_unknown_order_404(self, customer):
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": "656565656565656565656565", "event": "placed"},
                          headers=H(customer["token"]), timeout=30)
        assert r.status_code == 404

    def test_unauthenticated_rejected(self, variant_order):
        r = requests.post(f"{API}/notify/order-whatsapp",
                          json={"order_id": variant_order["id"], "event": "placed"}, timeout=30)
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------- regression
class TestRegressionSanity:
    def test_tracker_statuses_and_delivered_flow(self, admin_token, customer, variant_order):
        r = requests.patch(f"{API}/admin/orders/{variant_order['id']}/status",
                           json={"status": "Delivered"}, headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        g = requests.get(f"{API}/orders/{variant_order['id']}", headers=H(customer["token"]), timeout=30)
        assert g.json()["status"] == "Delivered"

    def test_coupon_still_applies(self, admin_token, customer, created_ids, category_slug):
        code = f"TESTIT12{TS % 100000}"
        c = requests.post(f"{API}/admin/coupons", json={"code": code, "discount_pct": 10, "min_amount": 0,
                                                 "active": True}, headers=H(admin_token), timeout=30)
        assert c.status_code in (200, 201), c.text[:300]
        p = make_product(admin_token, created_ids, category_slug, "coup",
                         variants=[{"label": "1 kg", "price": 100.0, "unit": "1 kg"}])
        body = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": 1, "quantity": 1,
                       "image": p["image"], "unit": "x", "variant_label": "1 kg"}],
            "address": ADDRESS, "payment_method": "COD", "coupon_code": code,
        }
        r = requests.post(f"{API}/orders", json=body, headers=H(customer["token"]), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        o = r.json()
        assert o["subtotal"] == 100.0
        assert o["discount"] == 10.0
        assert o["total"] == round(100.0 + o["delivery_fee"] - 10.0, 2)

    def test_admin_sales_analytics(self, admin_token):
        r = requests.get(f"{API}/admin/analytics", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
