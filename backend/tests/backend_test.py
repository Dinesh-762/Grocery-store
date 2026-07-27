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
def real_item(client, qty=1, min_price=0, max_price=10**9):
    """Build an order item from a real DB product (server recomputes prices)."""
    prods = client.get(f"{BASE_URL}/api/products", timeout=30).json()
    cands = [p for p in prods if p.get("stock", 0) >= qty and min_price <= p["price"] <= max_price]
    assert cands, "no suitable product found for order test"
    p = cands[0]
    return p, [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                "quantity": qty, "image": p["image"], "unit": p["unit"]}]


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
        p, items = real_item(client, qty=1, max_price=400)
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["subtotal"] == round(p["price"], 2)
        assert d["delivery_fee"] == 30
        assert d["total"] == round(p["price"] + 30, 2)
        assert d["status"] == "Pending"
        assert "_id" not in d
        # verify persisted
        g = client.get(f"{BASE_URL}/api/orders/{d['id']}", headers=cust_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["total"] == d["total"]

    def test_order_free_delivery(self, client, cust_headers):
        prods = client.get(f"{BASE_URL}/api/products", timeout=30).json()
        p = next(x for x in prods if x.get("stock", 0) >= 3)
        qty = max(3, int(500 // p["price"]) + 1)
        qty = min(qty, p["stock"])
        if p["price"] * qty < 499:
            pytest.skip("no product with enough stock to cross free-delivery threshold")
        items = [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                  "quantity": qty, "image": p["image"], "unit": p["unit"]}]
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": self.ADDRESS, "payment_method": "UPI"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["subtotal"] == round(p["price"] * qty, 2)
        assert d["delivery_fee"] == 0
        assert d["total"] == d["subtotal"]

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
        _, items = real_item(client, qty=1)
        r = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": self.ADDRESS, "payment_method": "COD"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
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
        assert r.status_code == 400, f"got {r.status_code}"

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
        _, items = real_item(client, qty=1)
        addr = TestOrders.ADDRESS
        created = client.post(f"{BASE_URL}/api/orders", headers=cust_headers, json={
            "items": items, "address": addr, "payment_method": "COD"}, timeout=30)
        assert created.status_code == 200, created.text[:300]
        oid = created.json()["id"]

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


# --- REGRESSION #3: server-side price recompute + stock validation on POST /api/orders ---
class TestOrderPricingSecurity:
    @pytest.fixture(scope="class")
    def product(self, client):
        prods = client.get(f"{BASE_URL}/api/products", timeout=30).json()
        p = next((x for x in prods if x.get("stock", 0) > 2), prods[0])
        return p

    def _address(self):
        return {"full_name": "TEST_ Buyer", "phone": "9876543210", "line1": "1 Test St",
                "landmark": "", "area": "Test Area", "city": "Ambajogai", "pincode": "431517"}

    def test_manipulated_price_is_ignored(self, client, cust_headers, product):
        payload = {
            "items": [{"product_id": product["id"], "name": "HACKED", "price": 1,
                       "quantity": 2, "image": "x", "unit": "1 pc"}],
            "address": self._address(), "payment_method": "COD", "notes": "TEST_ price manipulation",
        }
        r = client.post(f"{BASE_URL}/api/orders", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        o = r.json()
        assert o["items"][0]["price"] == product["price"], f"client price accepted: {o['items'][0]['price']}"
        assert o["items"][0]["name"] == product["name"], "client-supplied name not overridden"
        expected_sub = round(product["price"] * 2, 2)
        assert o["subtotal"] == expected_sub, f"subtotal {o['subtotal']} != {expected_sub}"
        expected_fee = 0.0 if expected_sub >= 499 else 30.0
        assert o["delivery_fee"] == expected_fee
        assert o["total"] == round(expected_sub + expected_fee, 2)

        # GET verifies persistence
        g = client.get(f"{BASE_URL}/api/orders/{o['id']}", headers=cust_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["subtotal"] == expected_sub
        assert g.json()["items"][0]["price"] == product["price"]

    def test_insufficient_stock_returns_400(self, client, cust_headers, product):
        payload = {
            "items": [{"product_id": product["id"], "name": product["name"], "price": product["price"],
                       "quantity": 999999, "image": "x", "unit": "1 pc"}],
            "address": self._address(), "payment_method": "COD", "notes": "TEST_ stock",
        }
        r = client.post(f"{BASE_URL}/api/orders", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
        assert "stock" in r.text.lower()

    def test_unknown_product_rejected(self, client, cust_headers):
        payload = {
            "items": [{"product_id": "507f1f77bcf86cd799439011", "name": "Ghost", "price": 10,
                       "quantity": 1, "image": "x", "unit": "1 pc"}],
            "address": self._address(), "payment_method": "COD", "notes": "TEST_ ghost",
        }
        r = client.post(f"{BASE_URL}/api/orders", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 400, r.text[:200]

    def test_invalid_product_id_rejected(self, client, cust_headers):
        payload = {
            "items": [{"product_id": "not-an-oid", "name": "Ghost", "price": 10,
                       "quantity": 1, "image": "x", "unit": "1 pc"}],
            "address": self._address(), "payment_method": "COD", "notes": "TEST_ badoid",
        }
        r = client.post(f"{BASE_URL}/api/orders", json=payload, headers=cust_headers, timeout=30)
        assert r.status_code == 400, r.text[:200]


# --- REGRESSION #4: invalid ObjectId must never 500 ---
class TestObjectIdSafety:
    BAD = "not-an-objectid"
    MISSING = "507f1f77bcf86cd799439011"

    def test_delete_product_bad_id(self, client, admin_headers):
        r = client.delete(f"{BASE_URL}/api/products/{self.BAD}", headers=admin_headers, timeout=30)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_delete_product_missing_id(self, client, admin_headers):
        r = client.delete(f"{BASE_URL}/api/products/{self.MISSING}", headers=admin_headers, timeout=30)
        assert r.status_code == 404, f"got {r.status_code}: {r.text[:200]}"

    def test_put_product_bad_id(self, client, admin_headers):
        body = {"name": "TEST_ X", "slug": "test-x", "description": "d", "price": 10.0,
                "mrp": 12.0, "unit": "1 kg", "category_slug": "staples-grains",
                "image": "http://x/y.jpg", "stock": 5}
        r = client.put(f"{BASE_URL}/api/products/{self.BAD}", headers=admin_headers,
                       json=body, timeout=30)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_delete_category_bad_id(self, client, admin_headers):
        r = client.delete(f"{BASE_URL}/api/categories/{self.BAD}", headers=admin_headers, timeout=30)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_delete_category_missing_id(self, client, admin_headers):
        r = client.delete(f"{BASE_URL}/api/categories/{self.MISSING}", headers=admin_headers, timeout=30)
        assert r.status_code == 404, f"got {r.status_code}: {r.text[:200]}"

    def test_patch_order_status_bad_id(self, client, admin_headers):
        r = client.patch(f"{BASE_URL}/api/admin/orders/{self.BAD}/status", headers=admin_headers,
                         json={"status": "Packed"}, timeout=30)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_patch_order_status_missing_id(self, client, admin_headers):
        r = client.patch(f"{BASE_URL}/api/admin/orders/{self.MISSING}/status", headers=admin_headers,
                         json={"status": "Packed"}, timeout=30)
        assert r.status_code == 404, f"got {r.status_code}: {r.text[:200]}"

    def test_get_order_bad_id(self, client, cust_headers):
        r = client.get(f"{BASE_URL}/api/orders/{self.BAD}", headers=cust_headers, timeout=30)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text[:200]}"

    def test_get_order_missing_id(self, client, cust_headers):
        r = client.get(f"{BASE_URL}/api/orders/{self.MISSING}", headers=cust_headers, timeout=30)
        assert r.status_code == 404, f"got {r.status_code}: {r.text[:200]}"
