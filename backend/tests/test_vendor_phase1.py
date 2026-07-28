"""Phase 1 Multi-Vendor Marketplace backend tests.

Modules covered: vendor registration/gating, admin vendor approval, vendor products
CRUD + admin approval, coupons, checkout with coupon, vendor line-status propagation,
reorder, admin dashboard new fields, RBAC.
"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
TIMEOUT = 45

ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered", "Cancelled"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    password = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not password:
        pytest.skip("credentials missing in /app/memory/test_credentials.md")
    return {"email": email.group(1), "password": password.group(1)}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s, creds):
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def state():
    """Shared mutable state across the ordered flow."""
    return {}


@pytest.fixture(scope="module")
def customer(s):
    uid = uuid.uuid4().hex[:8]
    payload = {"name": "TEST Customer", "email": f"TEST_cust_{uid}@example.com",
               "password": "Test@123", "phone": "9876500000"}
    r = s.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    return {"token": r.json()["token"], "email": payload["email"], "id": r.json()["user"]["id"]}


class TestVendorPhase1Flow:
    # --- vendor registration ---
    def test_01_vendor_register(self, s, state):
        uid = uuid.uuid4().hex[:8]
        email = f"TEST_vendor_{uid}@example.com"
        payload = {
            "name": "TEST Vendor Owner", "email": email, "password": "Vendor@123",
            "phone": "9876511111", "business_name": f"TEST Kirana {uid}",
            "business_description": "Test vendor shop", "business_address": "Main Road Ambajogai",
            "business_pincode": "431517",
            "docs": {"aadhar_url": "https://x.test/a.png", "gst_url": "https://x.test/g.png",
                     "shop_license_url": "https://x.test/l.png"},
        }
        r = s.post(f"{BASE_URL}/api/vendors/register", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["success"] is True
        v = body["vendor"]
        assert v["status"] == "Pending"
        assert v["business_name"] == payload["business_name"]
        assert v["docs"]["gst_url"] == "https://x.test/g.png"
        assert "_id" not in v
        state.update({"vendor_email": email, "vendor_password": "Vendor@123",
                      "vendor_id": v["id"], "business_name": payload["business_name"]})

    def test_02_duplicate_vendor_email_rejected(self, s, state):
        r = s.post(f"{BASE_URL}/api/vendors/register", json={
            "name": "Dup", "email": state["vendor_email"], "password": "Vendor@123",
            "phone": "9", "business_name": "Dup", "business_address": "a", "business_pincode": "431517"},
            timeout=TIMEOUT)
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()

    def test_03_pending_vendor_login_blocked_403(self, s, state):
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": state["vendor_email"], "password": state["vendor_password"]}, timeout=TIMEOUT)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"
        assert "pending admin approval" in r.json()["detail"].lower()

    # --- admin vendor listing / approval ---
    def test_04_admin_lists_pending_vendor(self, s, admin_token, state):
        r = s.get(f"{BASE_URL}/api/admin/vendors", headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        rows = r.json()
        mine = [v for v in rows if v["id"] == state["vendor_id"]]
        assert mine, "registered vendor not returned by /api/admin/vendors"
        assert mine[0]["status"] == "Pending"
        assert mine[0]["docs"]["aadhar_url"]

    def test_05_admin_vendors_requires_admin(self, s, customer):
        r = s.get(f"{BASE_URL}/api/admin/vendors", headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_06_reject_then_login_blocked(self, s, admin_token, state):
        r = s.patch(f"{BASE_URL}/api/admin/vendors/{state['vendor_id']}/status",
                    json={"status": "Rejected", "reason": "TEST docs unclear"},
                    headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "Rejected"
        assert r.json()["rejection_reason"] == "TEST docs unclear"
        lr = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": state["vendor_email"], "password": state["vendor_password"]}, timeout=TIMEOUT)
        assert lr.status_code == 403
        assert "rejected" in lr.json()["detail"].lower()

    def test_07_invalid_vendor_status_400(self, s, admin_token, state):
        r = s.patch(f"{BASE_URL}/api/admin/vendors/{state['vendor_id']}/status",
                    json={"status": "Bogus"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 400

    def test_08_approve_vendor_and_login(self, s, admin_token, state):
        r = s.patch(f"{BASE_URL}/api/admin/vendors/{state['vendor_id']}/status",
                    json={"status": "Approved"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "Approved"
        assert body["rejection_reason"] == ""
        assert body["approved_at"]
        lr = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": state["vendor_email"], "password": state["vendor_password"]}, timeout=TIMEOUT)
        assert lr.status_code == 200, lr.text[:300]
        assert lr.json()["user"]["role"] == "vendor"
        state["vtoken"] = lr.json()["token"]

    def test_09_vendors_me_and_public_list(self, s, state):
        r = s.get(f"{BASE_URL}/api/vendors/me", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["id"] == state["vendor_id"]
        pub = s.get(f"{BASE_URL}/api/vendors", timeout=TIMEOUT)
        assert pub.status_code == 200
        assert any(v["id"] == state["vendor_id"] for v in pub.json())

    def test_10_vendor_dashboard_scoped(self, s, state):
        r = s.get(f"{BASE_URL}/api/vendor/dashboard", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ["vendor", "total_products", "approved_products", "pending_products",
                  "total_orders", "pending_orders", "delivered_orders", "revenue", "low_stock"]:
            assert k in d, f"missing {k}"
        assert d["vendor"]["id"] == state["vendor_id"]
        assert d["total_products"] == 0

    # --- vendor products ---
    def test_11_vendor_creates_pending_product(self, s, state):
        slug = f"test-vendor-prod-{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST Vendor Rice", "slug": slug, "description": "vendor item",
                   "price": 100, "mrp": 120, "unit": "1 kg", "category_slug": "staples-grains",
                   "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
                   "stock": 25, "featured": False, "popular": False}
        r = s.post(f"{BASE_URL}/api/vendor/products", json=payload, headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        p = r.json()
        assert p["approval_status"] == "pending"
        assert p["vendor_id"] == state["vendor_id"]
        assert p["vendor_name"] == state["business_name"]
        state.update({"prod_id": p["id"], "prod_slug": slug})

    def test_12_pending_product_hidden_from_public_listing(self, s, state):
        r = s.get(f"{BASE_URL}/api/products?limit=200", timeout=TIMEOUT)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert state["prod_id"] not in ids, "pending vendor product leaked into public /api/products"
        # also hidden from search
        sr = s.get(f"{BASE_URL}/api/products", params={"q": "TEST Vendor Rice"}, timeout=TIMEOUT)
        assert sr.status_code == 200
        assert state["prod_id"] not in [p["id"] for p in sr.json()]

    def test_13_admin_products_shows_pending(self, s, admin_token, state):
        r = s.get(f"{BASE_URL}/api/admin/products", headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        row = [p for p in r.json() if p["id"] == state["prod_id"]]
        assert row and row[0]["approval_status"] == "pending"
        f = s.get(f"{BASE_URL}/api/admin/products", params={"status": "pending"},
                  headers=_hdr(admin_token), timeout=TIMEOUT)
        assert f.status_code == 200
        assert all(p["approval_status"] == "pending" for p in f.json())

    def test_14_vendor_can_edit_own_product(self, s, state):
        payload = {"name": "TEST Vendor Rice v2", "slug": state["prod_slug"], "description": "updated",
                   "price": 111, "mrp": 130, "unit": "1 kg", "category_slug": "staples-grains",
                   "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
                   "stock": 30, "featured": False, "popular": False}
        r = s.put(f"{BASE_URL}/api/vendor/products/{state['prod_id']}", json=payload,
                  headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["price"] == 111
        g = s.get(f"{BASE_URL}/api/vendor/products", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert g.status_code == 200
        mine = [p for p in g.json() if p["id"] == state["prod_id"]]
        assert mine and mine[0]["price"] == 111 and mine[0]["name"] == "TEST Vendor Rice v2"
        assert all(p["vendor_id"] == state["vendor_id"] for p in g.json())

    def test_15_vendor_cannot_edit_other_product_403(self, s, state):
        legacy = s.get(f"{BASE_URL}/api/products?limit=1", timeout=TIMEOUT).json()[0]
        payload = {"name": "hacked", "slug": legacy["slug"], "description": "", "price": 1,
                   "unit": "1 kg", "category_slug": legacy["category_slug"], "image": legacy["image"], "stock": 1}
        r = s.put(f"{BASE_URL}/api/vendor/products/{legacy['id']}", json=payload,
                  headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"
        d = s.delete(f"{BASE_URL}/api/vendor/products/{legacy['id']}", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert d.status_code == 403

    def test_16_admin_approves_product_goes_live(self, s, admin_token, state):
        r = s.patch(f"{BASE_URL}/api/admin/products/{state['prod_id']}/approval",
                    json={"status": "approved"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["approval_status"] == "approved"
        pub = s.get(f"{BASE_URL}/api/products?limit=300", timeout=TIMEOUT).json()
        assert state["prod_id"] in [p["id"] for p in pub], "approved product not visible publicly"
        bad = s.patch(f"{BASE_URL}/api/admin/products/{state['prod_id']}/approval",
                      json={"status": "weird"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert bad.status_code == 400

    # --- coupons ---
    def test_17_admin_creates_coupon(self, s, admin_token, state):
        code = f"TEST{uuid.uuid4().hex[:5].upper()}"
        r = s.post(f"{BASE_URL}/api/admin/coupons",
                   json={"code": code.lower(), "discount_pct": 10, "min_amount": 0, "active": True},
                   headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        c = r.json()
        assert c["code"] == code, "coupon code should be upper-cased"
        assert c["discount_pct"] == 10
        state.update({"coupon": code, "coupon_id": c["id"]})
        lst = s.get(f"{BASE_URL}/api/admin/coupons", headers=_hdr(admin_token), timeout=TIMEOUT)
        assert lst.status_code == 200
        assert any(x["code"] == code for x in lst.json())

    def test_18_validate_coupon(self, s, state):
        r = s.get(f"{BASE_URL}/api/coupons/{state['coupon']}/validate", params={"subtotal": 200}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["discount"] == 20.0
        bad = s.get(f"{BASE_URL}/api/coupons/NOPE123/validate", params={"subtotal": 200}, timeout=TIMEOUT)
        assert bad.status_code == 404

    def test_19_min_amount_coupon_enforced(self, s, admin_token, state):
        code = f"TESTMIN{uuid.uuid4().hex[:4].upper()}"
        r = s.post(f"{BASE_URL}/api/admin/coupons",
                   json={"code": code, "discount_pct": 20, "min_amount": 100000, "active": True},
                   headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        state["min_coupon_id"] = r.json()["id"]
        state["min_coupon"] = code
        v = s.get(f"{BASE_URL}/api/coupons/{code}/validate", params={"subtotal": 100}, timeout=TIMEOUT)
        assert v.status_code == 400
        assert "at least" in v.json()["detail"]

    # --- order with coupon ---
    def test_20_customer_order_with_coupon(self, s, customer, state):
        prod = s.get(f"{BASE_URL}/api/products/{state['prod_slug']}", timeout=TIMEOUT).json()
        items = [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"],
                  "quantity": 2, "image": prod["image"], "unit": prod["unit"]}]
        payload = {"items": items,
                   "address": {"full_name": "TEST Customer", "phone": "9876500000", "line1": "1 Test St",
                               "area": "Main", "city": "Ambajogai", "pincode": "431517"},
                   "payment_method": "COD", "notes": "", "coupon_code": state["coupon"].lower()}
        r = s.post(f"{BASE_URL}/api/orders", json=payload, headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:400]
        o = r.json()
        expected_sub = round(prod["price"] * 2, 2)
        assert o["subtotal"] == expected_sub
        assert o["discount"] == round(expected_sub * 0.1, 2)
        assert o["coupon"]["code"] == state["coupon"]
        assert o["total"] == round(expected_sub + o["delivery_fee"] - o["discount"], 2)
        assert o["status"] == "Pending"
        assert o["items"][0]["vendor_id"] == state["vendor_id"]
        assert o["items"][0]["line_status"] == "Pending"
        state["order_id"] = o["id"]
        state["order_total"] = o["total"]

    def test_21_invalid_coupon_on_order_400(self, s, customer, state):
        prod = s.get(f"{BASE_URL}/api/products/{state['prod_slug']}", timeout=TIMEOUT).json()
        payload = {"items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"],
                             "quantity": 1, "image": prod["image"], "unit": prod["unit"]}],
                   "address": {"full_name": "TEST Customer", "phone": "9876500000", "line1": "1 Test St",
                               "area": "Main", "city": "Ambajogai", "pincode": "431517"},
                   "payment_method": "COD", "coupon_code": "DOESNOTEXIST"}
        r = s.post(f"{BASE_URL}/api/orders", json=payload, headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert r.status_code == 400
        assert "coupon" in r.json()["detail"].lower()

    # --- vendor order visibility & line status ---
    def test_22_vendor_sees_only_own_items(self, s, state):
        r = s.get(f"{BASE_URL}/api/vendor/orders", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        rows = [o for o in r.json() if o["id"] == state["order_id"]]
        assert rows, "vendor cannot see order containing its item"
        o = rows[0]
        assert all(i["vendor_id"] == state["vendor_id"] for i in o["items"])
        assert o["my_subtotal"] == round(sum(i["price"] * i["quantity"] for i in o["items"]), 2)
        assert o["my_status"] == "Pending"
        assert o["overall_status"] == "Pending"

    def test_23_vendor_line_status_updates_overall(self, s, customer, state):
        r = s.patch(f"{BASE_URL}/api/vendor/orders/{state['order_id']}/line-status",
                    json={"status": "Preparing"}, headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "Preparing"
        # customer sees the propagated status
        cg = s.get(f"{BASE_URL}/api/orders/{state['order_id']}", headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert cg.status_code == 200
        assert cg.json()["status"] == "Preparing"
        assert cg.json()["items"][0]["line_status"] == "Preparing"
        assert any(h["status"] == "Preparing" for h in cg.json()["status_history"])

    def test_24_vendor_invalid_line_status_400(self, s, state):
        r = s.patch(f"{BASE_URL}/api/vendor/orders/{state['order_id']}/line-status",
                    json={"status": "Nope"}, headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 400

    def test_25_vendor_cannot_touch_foreign_order(self, s, admin_token, state):
        orders = s.get(f"{BASE_URL}/api/admin/orders", headers=_hdr(admin_token), timeout=TIMEOUT).json()
        foreign = [o for o in orders
                   if all(i.get("vendor_id") != state["vendor_id"] for i in o["items"])]
        if not foreign:
            pytest.skip("no foreign order available")
        r = s.patch(f"{BASE_URL}/api/vendor/orders/{foreign[0]['id']}/line-status",
                    json={"status": "Packed"}, headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
        assert r.status_code == 403

    # --- reorder ---
    def test_26_reorder_returns_available_items(self, s, customer, state):
        r = s.get(f"{BASE_URL}/api/orders/{state['order_id']}/reorder",
                  headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        items = r.json()["items"]
        assert len(items) == 1
        assert items[0]["product_id"] and items[0]["quantity"] == 2
        assert "in_stock" in items[0]

    def test_27_reorder_other_users_order_404(self, s, admin_token, state):
        r = s.get(f"{BASE_URL}/api/orders/{state['order_id']}/reorder",
                  headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 404

    def test_28_reorder_skips_unapproved_products(self, s, admin_token, customer, state):
        # flip product back to pending -> should be skipped
        s.patch(f"{BASE_URL}/api/admin/products/{state['prod_id']}/approval",
                json={"status": "pending"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        r = s.get(f"{BASE_URL}/api/orders/{state['order_id']}/reorder",
                  headers=_hdr(customer["token"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["items"] == []
        s.patch(f"{BASE_URL}/api/admin/products/{state['prod_id']}/approval",
                json={"status": "approved"}, headers=_hdr(admin_token), timeout=TIMEOUT)

    # --- admin regression + new dashboard fields ---
    def test_29_admin_dashboard_new_fields(self, s, admin_token):
        r = s.get(f"{BASE_URL}/api/admin/dashboard", headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_vendors", "pending_vendors", "pending_products", "cancelled_orders"]:
            assert k in d, f"missing dashboard field {k}"
            assert isinstance(d[k], int)
        assert d["total_vendors"] >= 1

    def test_30_admin_order_status_new_labels(self, s, admin_token, state):
        for st in ["Accepted", "Ready", "Out For Delivery"]:
            r = s.patch(f"{BASE_URL}/api/admin/orders/{state['order_id']}/status",
                        json={"status": st}, headers=_hdr(admin_token), timeout=TIMEOUT)
            assert r.status_code == 200, f"{st} -> {r.status_code} {r.text[:200]}"
            assert r.json()["status"] == st
        bad = s.patch(f"{BASE_URL}/api/admin/orders/{state['order_id']}/status",
                      json={"status": "Confirmed"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert bad.status_code == 400, "legacy 'Confirmed' status should be rejected"

    # --- RBAC / security ---
    def test_31_customer_blocked_from_vendor_endpoints(self, s, customer):
        for path in ["/api/vendor/dashboard", "/api/vendor/products", "/api/vendor/orders", "/api/vendors/me"]:
            r = s.get(f"{BASE_URL}{path}", headers=_hdr(customer["token"]), timeout=TIMEOUT)
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_32_admin_blocked_from_vendor_endpoints(self, s, admin_token):
        r = s.get(f"{BASE_URL}/api/vendor/dashboard", headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_33_vendor_blocked_from_admin_endpoints(self, s, state):
        for path in ["/api/admin/dashboard", "/api/admin/vendors", "/api/admin/products", "/api/admin/coupons"]:
            r = s.get(f"{BASE_URL}{path}", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_34_unauthenticated_401(self, s):
        for path in ["/api/vendor/dashboard", "/api/admin/vendors", "/api/orders/my"]:
            r = s.get(f"{BASE_URL}{path}", timeout=TIMEOUT)
            assert r.status_code == 401, f"{path} -> {r.status_code}"

    def test_35_suspended_vendor_blocked_everywhere(self, s, admin_token, state):
        r = s.patch(f"{BASE_URL}/api/admin/vendors/{state['vendor_id']}/status",
                    json={"status": "Suspended"}, headers=_hdr(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["status"] == "Suspended"
        lr = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": state["vendor_email"], "password": state["vendor_password"]}, timeout=TIMEOUT)
        assert lr.status_code == 403 and "suspended" in lr.json()["detail"].lower()
        # existing token must also be rejected on vendor-scoped endpoints
        for path in ["/api/vendor/dashboard", "/api/vendor/products", "/api/vendor/orders"]:
            vr = s.get(f"{BASE_URL}{path}", headers=_hdr(state["vtoken"]), timeout=TIMEOUT)
            assert vr.status_code == 403, f"{path} -> {vr.status_code} for suspended vendor"

    def test_36_suspended_vendor_products_hidden(self, s, state):
        pub = s.get(f"{BASE_URL}/api/products?limit=300", timeout=TIMEOUT).json()
        assert state["prod_id"] not in [p["id"] for p in pub], "suspended vendor product still public"


@pytest.fixture(scope="module", autouse=True)
def cleanup(s, admin_token, state):
    yield
    hdr = _hdr(admin_token)
    if state.get("prod_id"):
        s.delete(f"{BASE_URL}/api/products/{state['prod_id']}", headers=hdr, timeout=TIMEOUT)
    for key in ("coupon_id", "min_coupon_id"):
        if state.get(key):
            s.delete(f"{BASE_URL}/api/admin/coupons/{state[key]}", headers=hdr, timeout=TIMEOUT)
