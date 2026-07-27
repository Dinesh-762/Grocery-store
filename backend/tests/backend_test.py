"""Backend API tests for Ambajogai Grocery Store."""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content).group(1)
    password = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content).group(1)
    return {"email": email, "password": password}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(client, creds):
    r = client.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer(client):
    """Register a fresh TEST_ customer."""
    email = f"TEST_e2e_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "TEST_ Customer", "email": email, "password": "Test@1234", "phone": "9876543210"}
    r = client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["user"]["email"] == email.lower()
    assert data["user"]["role"] == "customer"
    return {"email": email, "password": "Test@1234", "token": data["token"], "id": data["user"]["id"]}


@pytest.fixture(scope="session")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}"}


# --- Health / store info ---
class TestPublic:
    def test_root(self, client):
        r = client.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_store_info(self, client):
        r = client.get(f"{BASE_URL}/api/store/info", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["name", "whatsapp", "upi_id"]:
            assert d.get(k)

    def test_categories(self, client):
        r = client.get(f"{BASE_URL}/api/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 6
        assert all("id" in c and "_id" not in c for c in cats)
        assert any(c["slug"] == "fruits-vegetables" for c in cats)

    def test_reviews(self, client):
        r = client.get(f"{BASE_URL}/api/reviews", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 3


# --- Products ---
class TestProducts:
    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/products", timeout=30)
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) >= 20
        assert all("_id" not in p for p in ps)

    def test_filter_category(self, client):
        r = client.get(f"{BASE_URL}/api/products?category=dairy-bakery", timeout=30)
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) > 0
        assert all(p["category_slug"] == "dairy-bakery" for p in ps)

    def test_search(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=milk", timeout=30)
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) > 0
        assert any("milk" in p["name"].lower() for p in ps)

    def test_search_no_results(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=zzzznotaproduct", timeout=30)
        assert r.status_code == 200
        assert r.json() == []

    def test_featured_popular(self, client):
        r = client.get(f"{BASE_URL}/api/products?featured=true", timeout=30)
        assert r.status_code == 200
        assert all(p["featured"] for p in r.json())
        r2 = client.get(f"{BASE_URL}/api/products?popular=true", timeout=30)
        assert all(p["popular"] for p in r2.json())

    def test_get_by_slug(self, client):
        r = client.get(f"{BASE_URL}/api/products/fresh-tomato", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "Fresh Tomato"
        assert d["price"] == 30

    def test_get_missing(self, client):
        r = client.get(f"{BASE_URL}/api/products/nope-nope", timeout=30)
        assert r.status_code == 404


# --- Auth ---
class TestAuth:
    def test_login_admin(self, client, creds):
        r = client.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_login_bad_password(self, client, creds):
        r = client.post(f"{BASE_URL}/api/auth/login", json={"email": creds["email"], "password": "wrong"}, timeout=30)
        assert r.status_code == 401
        assert isinstance(r.json()["detail"], str)

    def test_me(self, client, cust_headers, customer):
        r = client.get(f"{BASE_URL}/api/auth/me", headers=cust_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == customer["email"].lower()

    def test_me_no_token(self, client):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_bad_token(self, client):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer abc.def.ghi"}, timeout=30)
        assert r.status_code == 401

    def test_duplicate_register(self, client, customer):
        r = client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Dup", "email": customer["email"], "password": "Test@1234"}, timeout=30)
        assert r.status_code == 400

    def test_register_validation(self, client):
        r = client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "A", "email": "notanemail", "password": "123"}, timeout=30)
        assert r.status_code == 422

    def test_bcrypt_hash_format(self, client, creds):
        # verify stored hash format via direct DB check
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")

        async def _check():
            c = AsyncIOMotorClient(env["MONGO_URL"])
            u = await c[env["DB_NAME"]].users.find_one({"email": creds["email"]})
            c.close()
            return u

        u = asyncio.run(_check())
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]


# --- OTP (mocked) ---
class TestOTP:
    def test_otp_flow(self, client):
        phone = "9990001111"
        r = client.post(f"{BASE_URL}/api/auth/otp/request", json={"phone": phone}, timeout=30)
        assert r.status_code == 200
        code = r.json()["debug_code"]
        assert len(code) == 6
        bad = client.post(f"{BASE_URL}/api/auth/otp/verify", json={"phone": phone, "code": "000000"}, timeout=30)
        assert bad.status_code == 400
        ok = client.post(f"{BASE_URL}/api/auth/otp/verify", json={"phone": phone, "code": code}, timeout=30)
        assert ok.status_code == 200


# --- Orders ---
class TestOrders:
    @staticmethod
    def _items(price, qty=1):
        return [{"product_id": str(uuid.uuid4().hex[:24]), "name": "TEST_ Item", "price": price,
                 "quantity": qty, "image": "http://x/y.jpg", "unit": "1 kg"}]

    ADDRESS = {"full_name": "TEST_ User", "phone": "9876543210", "line1": "12 Main Rd",
               "area": "Bazaar", "city": "Ambajogai", "pincode": "431517"}

    def test_create_order_requires_auth(self, client):
        r = requests.post(f"{BASE_URL}/api/orders", json={
            "items": self._items(100), "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 401

    def test_order_delivery_fee_below_threshold(self, client, cust_headers):
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": self._items(100, 2), "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["subtotal"] == 200
        assert d["delivery_fee"] == 30
        assert d["total"] == 230
        assert d["status"] == "Pending"
        assert "_id" not in d
        # verify persisted
        g = client.get(f"{BASE_URL}/api/orders/{d['id']}", headers=cust_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["total"] == 230

    def test_order_free_delivery(self, client, cust_headers):
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": self._items(250, 2), "address": self.ADDRESS, "payment_method": "UPI"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["subtotal"] == 500
        assert d["delivery_fee"] == 0
        assert d["total"] == 500

    def test_empty_cart_rejected(self, client, cust_headers):
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": [], "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 400

    def test_my_orders(self, client, cust_headers):
        r = client.get(f"{BASE_URL}/api/orders/my", headers=cust_headers, timeout=30)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) >= 2
        assert all(o["status"] in ["Pending", "Confirmed", "Packed", "Out For Delivery", "Delivered", "Cancelled"] for o in orders)

    def test_order_access_denied_other_user(self, client, cust_headers):
        # create order as customer1
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": self._items(50), "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        oid = r.json()["id"]
        # register second customer
        email = f"TEST_other_{uuid.uuid4().hex[:6]}@example.com"
        r2 = client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST_ Other", "email": email, "password": "Test@1234"}, timeout=30)
        tok = r2.json()["token"]
        g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert g.status_code == 403

    def test_order_invalid_id(self, client, cust_headers):
        r = client.get(f"{BASE_URL}/api/orders/not-an-objectid", headers=cust_headers, timeout=30)
        assert r.status_code == 404

    def test_stock_decrement(self, client, cust_headers):
        p = client.get(f"{BASE_URL}/api/products/potato", timeout=30).json()
        before = p["stock"]
        items = [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                  "quantity": 2, "image": p["image"], "unit": p["unit"]}]
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 200
        after = client.get(f"{BASE_URL}/api/products/potato", timeout=30).json()["stock"]
        assert after == before - 2


# --- Admin ---
class TestAdmin:
    def test_dashboard(self, client, admin_headers):
        r = client.get(f"{BASE_URL}/api/admin/dashboard", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_products", "total_orders", "total_users", "revenue", "low_stock", "recent_orders"]:
            assert k in d
        assert d["total_products"] >= 20

    def test_dashboard_forbidden_for_customer(self, client, cust_headers):
        r = client.get(f"{BASE_URL}/api/admin/dashboard", headers=cust_headers, timeout=30)
        assert r.status_code == 403

    def test_customers_list(self, client, admin_headers, customer):
        r = client.get(f"{BASE_URL}/api/admin/customers", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert any(c["email"] == customer["email"].lower() for c in r.json())

    def test_admin_orders_and_status_flow(self, client, admin_headers, cust_headers):
        items = [{"product_id": "000000000000000000000000", "name": "TEST_ Status Item", "price": 60,
                  "quantity": 1, "image": "http://x/y.jpg", "unit": "1 kg"}]
        addr = TestOrders.ADDRESS
        oid = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": addr, "payment_method": "COD"}, timeout=30).json()["id"]

        lst = client.get(f"{BASE_URL}/api/admin/orders", headers=admin_headers, timeout=30)
        assert lst.status_code == 200
        assert any(o["id"] == oid for o in lst.json())

        upd = client.patch(f"{BASE_URL}/api/admin/orders/{oid}/status",
                           headers=admin_headers, json={"status": "Confirmed"}, timeout=30)
        assert upd.status_code == 200
        assert upd.json()["status"] == "Confirmed"

        # customer sees updated status
        g = client.get(f"{BASE_URL}/api/orders/{oid}", headers=cust_headers, timeout=30)
        assert g.json()["status"] == "Confirmed"
        assert len(g.json()["status_history"]) == 2

        # filter
        f = client.get(f"{BASE_URL}/api/admin/orders?status_filter=Confirmed", headers=admin_headers, timeout=30)
        assert f.status_code == 200
        assert all(o["status"] == "Confirmed" for o in f.json())

        bad = client.patch(f"{BASE_URL}/api/admin/orders/{oid}/status",
                           headers=admin_headers, json={"status": "Bogus"}, timeout=30)
        assert bad.status_code == 400

    def test_product_crud(self, client, admin_headers):
        slug = f"test-product-{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST_ Product", "slug": slug, "description": "desc", "price": 99.0,
                   "mrp": 120.0, "unit": "1 kg", "category_slug": "staples-grains",
                   "image": "https://example.com/i.jpg", "stock": 10}
        c = client.post(f"{BASE_URL}/api/products", headers=admin_headers, json=payload, timeout=30)
        assert c.status_code == 200, c.text[:300]
        pid = c.json()["id"]
        assert c.json()["price"] == 99.0

        g = client.get(f"{BASE_URL}/api/products/{slug}", timeout=30)
        assert g.status_code == 200 and g.json()["name"] == "TEST_ Product"

        dup = client.post(f"{BASE_URL}/api/products", headers=admin_headers, json=payload, timeout=30)
        assert dup.status_code == 400

        payload["price"] = 149.0
        payload["name"] = "TEST_ Product Updated"
        u = client.put(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, json=payload, timeout=30)
        assert u.status_code == 200 and u.json()["price"] == 149.0
        assert client.get(f"{BASE_URL}/api/products/{slug}", timeout=30).json()["name"] == "TEST_ Product Updated"

        d = client.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, timeout=30)
        assert d.status_code == 200
        assert client.get(f"{BASE_URL}/api/products/{slug}", timeout=30).status_code == 404

    def test_product_create_requires_admin(self, client, cust_headers):
        r = client.post(f"{BASE_URL}/api/products", headers=cust_headers, json={
            "name": "x", "slug": "x-x", "price": 1, "category_slug": "c", "image": "u"}, timeout=30)
        assert r.status_code == 403

    def test_category_crud(self, client, admin_headers):
        slug = f"test-cat-{uuid.uuid4().hex[:6]}"
        c = client.post(f"{BASE_URL}/api/categories", headers=admin_headers,
                        json={"name": "TEST_ Cat", "slug": slug, "image": "https://example.com/c.jpg"}, timeout=30)
        assert c.status_code == 200, c.text[:300]
        cid = c.json()["id"]
        assert any(x["slug"] == slug for x in client.get(f"{BASE_URL}/api/categories", timeout=30).json())
        d = client.delete(f"{BASE_URL}/api/categories/{cid}", headers=admin_headers, timeout=30)
        assert d.status_code == 200
        assert not any(x["slug"] == slug for x in client.get(f"{BASE_URL}/api/categories", timeout=30).json())


# --- Security observations ---
class TestSecurity:
    def test_no_brute_force_lockout(self, client, creds):
        """Documents whether repeated bad logins are throttled."""
        codes = []
        for _ in range(6):
            r = client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": creds["email"], "password": "wrongpass"}, timeout=30)
            codes.append(r.status_code)
            time.sleep(0.1)
        locked = any(c == 429 for c in codes)
        # good password must still work if there is no lockout
        ok = client.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
        assert ok.status_code == 200 or locked, f"login broken after failures: {ok.status_code}"
