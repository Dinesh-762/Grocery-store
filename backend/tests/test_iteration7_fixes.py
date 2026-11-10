"""Iteration 7 — retest of the two HIGH frontend fixes' backend surface + PDP 404 for unapproved products."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN = {"email": "admin@ambajogai.com", "password": "Admin@123"}


def as_list(data):
    if isinstance(data, list):
        return data
    return data.get("items", [])


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def vendor_product(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/products", timeout=30)
    assert r.status_code == 200, r.text[:300]
    items = as_list(r.json())
    target = next((p for p in items if p.get("slug") == "test-vendor-ui-tomato"), None)
    if not target:
        target = next((p for p in items if p.get("vendor_id")), None)
    if not target:
        pytest.skip("no vendor product available")
    return target


# --- MINOR BACKEND: public PDP must 404 for non-approved products ---
class TestPublicPdpApproval:
    def test_pending_product_slug_returns_404(self, admin_client, vendor_product):
        pid, slug = vendor_product["id"], vendor_product["slug"]
        r = admin_client.patch(f"{BASE_URL}/api/admin/products/{pid}/approval", json={"status": "pending"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        pub = requests.get(f"{BASE_URL}/api/products/{slug}", timeout=30)
        assert pub.status_code == 404, f"expected 404 for pending product, got {pub.status_code}"

    def test_rejected_product_slug_returns_404(self, admin_client, vendor_product):
        pid, slug = vendor_product["id"], vendor_product["slug"]
        assert admin_client.patch(f"{BASE_URL}/api/admin/products/{pid}/approval", json={"status": "rejected"}, timeout=30).status_code == 200
        assert requests.get(f"{BASE_URL}/api/products/{slug}", timeout=30).status_code == 404

    def test_approved_product_slug_returns_200(self, admin_client, vendor_product):
        pid, slug = vendor_product["id"], vendor_product["slug"]
        assert admin_client.patch(f"{BASE_URL}/api/admin/products/{pid}/approval", json={"status": "approved"}, timeout=30).status_code == 200
        pub = requests.get(f"{BASE_URL}/api/products/{slug}", timeout=30)
        assert pub.status_code == 200, pub.text[:300]
        assert pub.json()["slug"] == slug
        assert "_id" not in pub.json()


# --- Order status transitions used by the Admin ALL_STATUSES dropdown ---
class TestAdminOrderStatuses:
    @pytest.mark.parametrize("status", ["Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered"])
    def test_each_status_accepted(self, admin_client, status):
        r = admin_client.get(f"{BASE_URL}/api/admin/orders", timeout=30)
        assert r.status_code == 200
        orders = as_list(r.json())
        if not orders:
            pytest.skip("no orders")
        oid = orders[0]["id"]
        p = admin_client.patch(f"{BASE_URL}/api/admin/orders/{oid}/status", json={"status": status}, timeout=30)
        assert p.status_code == 200, f"{status}: {p.status_code} {p.text[:200]}"
        g = admin_client.get(f"{BASE_URL}/api/admin/orders/{oid}", timeout=30)
        if g.status_code == 200:
            assert g.json()["status"] == status

    def test_invalid_status_rejected(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/orders", timeout=30)
        orders = as_list(r.json())
        if not orders:
            pytest.skip("no orders")
        p = admin_client.patch(f"{BASE_URL}/api/admin/orders/{orders[0]['id']}/status", json={"status": "Confirmed"}, timeout=30)
        assert p.status_code == 400
