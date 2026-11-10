"""Iteration 8 — Public vendor storefront endpoint GET /api/vendors/{vendor_id}"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

APPROVED_VENDOR_ID = "6a68cd452d6830a591905de5"
VENDOR_PRODUCT_SLUG = "test-vendor-ui-tomato"
ADMIN = {"email": "admin@ambajogai.com", "password": "Admin@123"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin(client, admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


class TestPublicVendorEndpoint:
    def test_happy_path_approved_vendor(self, client):
        r = client.get(f"{API}/vendors/{APPROVED_VENDOR_ID}")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ["business_name", "business_description", "business_address",
                  "business_pincode", "created_at", "products"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["products"], list)
        assert "_id" not in d
        for p in d["products"]:
            assert "_id" not in p
            assert p.get("approval_status") in (None, "approved"), p

    def test_malformed_id_returns_400(self, client):
        r = client.get(f"{API}/vendors/not-an-objectid")
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
        assert "Invalid id" in r.json().get("detail", "")

    def test_nonexistent_id_returns_404(self, client):
        r = client.get(f"{API}/vendors/000000000000000000000000")
        assert r.status_code == 404, r.text[:200]

    def test_non_approved_vendor_returns_404(self, client, admin):
        vendors = admin.get(f"{API}/admin/vendors").json()
        assert isinstance(vendors, list) and vendors, "no vendors seeded"
        non_approved = [v for v in vendors if v.get("status") != "Approved"]
        if not non_approved:
            pytest.skip("no non-approved vendor available")
        for v in non_approved[:3]:
            r = client.get(f"{API}/vendors/{v['id']}")
            assert r.status_code == 404, (
                f"vendor {v['id']} status={v.get('status')} leaked: {r.status_code}")

    def test_pending_products_do_not_leak(self, client, admin):
        """Flip the approved vendor product to pending, verify it disappears, flip back."""
        r = client.get(f"{API}/vendors/{APPROVED_VENDOR_ID}")
        assert r.status_code == 200
        products = r.json()["products"]
        target = next((p for p in products if p["slug"] == VENDOR_PRODUCT_SLUG), None)
        if not target:
            pytest.skip(f"{VENDOR_PRODUCT_SLUG} not present in storefront")
        pid = target["id"]
        try:
            pr = admin.patch(f"{API}/admin/products/{pid}/approval", json={"status": "pending"})
            assert pr.status_code == 200, pr.text[:300]
            after = client.get(f"{API}/vendors/{APPROVED_VENDOR_ID}").json()["products"]
            assert all(p["slug"] != VENDOR_PRODUCT_SLUG for p in after), "pending product leaked"
            assert len(after) == len(products) - 1
        finally:
            back = admin.patch(f"{API}/admin/products/{pid}/approval", json={"status": "approved"})
            assert back.status_code == 200, back.text[:300]
        restored = client.get(f"{API}/vendors/{APPROVED_VENDOR_ID}").json()["products"]
        assert any(p["slug"] == VENDOR_PRODUCT_SLUG for p in restored)


class TestSmokeRegression:
    def test_products_list(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", body.get("products"))
        assert isinstance(items, list) and len(items) > 0

    def test_public_vendors_list(self, client):
        r = client.get(f"{API}/vendors")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_vendor_product_detail_exposes_vendor(self, client):
        r = client.get(f"{API}/products/{VENDOR_PRODUCT_SLUG}")
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d.get("vendor_id") == APPROVED_VENDOR_ID
        assert d.get("vendor_name")

    def test_categories(self, client):
        r = client.get(f"{API}/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
