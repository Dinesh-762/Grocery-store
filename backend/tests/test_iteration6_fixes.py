"""Iteration 6 regression: admin order-status new list, admin product approval, admin product creation approval_status."""
import os
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
NEW_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered", "Cancelled"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code} {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def state():
    return {}


# ---- Admin products listing (fix #2 backend support) ----
class TestAdminProducts:
    def test_admin_products_list_includes_approval_and_vendor(self, admin):
        r = admin.get(f"{API}/admin/products?limit=500", timeout=30)
        assert r.status_code == 200, r.text[:300]
        items = r.json()
        items = items.get("items", items) if isinstance(items, dict) else items
        assert isinstance(items, list) and len(items) > 0
        assert "approval_status" in items[0]
        assert not any("_id" in p for p in items)

    def test_admin_products_status_filter_pending(self, admin):
        r = admin.get(f"{API}/admin/products?status=pending", timeout=30)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        for p in items:
            assert p["approval_status"] == "pending"

    def test_admin_created_product_is_approved(self, admin, state):
        cats = admin.get(f"{API}/categories", timeout=30).json()
        cat = cats[0]
        sfx = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_it6 Product {sfx}",
            "slug": f"test-it6-product-{sfx}",
            "price": 55,
            "unit": "1 kg",
            "category_slug": cat["slug"],
            "stock": 10,
            "description": "test",
            "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655",
        }
        r = admin.post(f"{API}/products", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        body = r.json()
        assert body.get("approval_status") == "approved", body
        state["pid"] = body["id"]
        state["slug"] = body.get("slug")
        # persisted
        g = admin.get(f"{API}/products/{body['slug']}", timeout=30)
        assert g.status_code == 200

    def test_approval_endpoint_roundtrip(self, admin, state):
        pid = state.get("pid")
        assert pid, "prior test failed"
        r = admin.patch(f"{API}/admin/products/{pid}/approval", json={"status": "pending"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        # should now be hidden from public list
        pub = requests.get(f"{API}/products?limit=500", timeout=30).json()
        pub_items = pub.get("items", pub) if isinstance(pub, dict) else pub
        assert all(p["id"] != pid for p in pub_items), "pending product still public"
        r2 = admin.patch(f"{API}/admin/products/{pid}/approval", json={"status": "approved"}, timeout=30)
        assert r2.status_code == 200
        pub2 = requests.get(f"{API}/products?limit=500", timeout=30).json()
        pub2_items = pub2.get("items", pub2) if isinstance(pub2, dict) else pub2
        assert any(p["id"] == pid for p in pub2_items), "approved product not public"

    def test_approval_invalid_status_rejected(self, admin, state):
        pid = state.get("pid")
        r = admin.patch(f"{API}/admin/products/{pid}/approval", json={"status": "bogus"}, timeout=30)
        assert r.status_code in (400, 422), r.status_code

    def test_cleanup_product(self, admin, state):
        pid = state.get("pid")
        if pid:
            r = admin.delete(f"{API}/products/{pid}", timeout=30)
            assert r.status_code in (200, 204, 404)


# ---- Admin order status with new statuses (fix #1 backend side) ----
class TestAdminOrderStatus:
    def test_new_statuses_accepted(self, admin):
        r = admin.get(f"{API}/admin/orders", timeout=30)
        assert r.status_code == 200
        data = r.json()
        orders = data.get("items", data) if isinstance(data, dict) else data
        if not orders:
            pytest.skip("no orders to update")
        oid = orders[0]["id"]
        original = orders[0]["status"]
        for st in ["Accepted", "Preparing", "Ready"]:
            resp = admin.patch(f"{API}/admin/orders/{oid}/status", json={"status": st}, timeout=30)
            assert resp.status_code == 200, f"{st} -> {resp.status_code} {resp.text[:200]}"
            g = admin.get(f"{API}/admin/orders", timeout=30).json()
            g = g.get("items", g) if isinstance(g, dict) else g
            match = [o for o in g if o["id"] == oid][0]
            assert match["status"] == st
        admin.patch(f"{API}/admin/orders/{oid}/status", json={"status": original}, timeout=30)

    def test_old_status_confirmed_rejected(self, admin):
        r = admin.get(f"{API}/admin/orders", timeout=30).json()
        orders = r.get("items", r) if isinstance(r, dict) else r
        if not orders:
            pytest.skip("no orders")
        resp = admin.patch(f"{API}/admin/orders/{orders[0]['id']}/status", json={"status": "Confirmed"}, timeout=30)
        assert resp.status_code == 400, resp.status_code
