"""
Iteration 16 backend tests — NEW features:
- forgot-password / reset-password OTP flow (Emergent Resend)
- saved delivery addresses CRUD
- strict order status flow (PATCH /api/admin/orders/{id}/status)
- new-order alert polling endpoints (admin pending-count, delivery new-count)
- delivery fee formula in POST /api/orders
- category image URL
"""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId
import bcrypt

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

mongo = MongoClient(backend_env["MONGO_URL"])
db = mongo[backend_env["DB_NAME"]]

ADMIN = {"email": "admin@ambajogai.com", "password": "Admin@123"}
STAMP = int(time.time())
WORKER = os.environ.get("PYTEST_XDIST_WORKER", "main")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    return login(**ADMIN)


@pytest.fixture(scope="session")
def customer():
    email = f"TEST_it16_cust_{STAMP}_{WORKER}@example.com"
    pwd = "Test@123"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST It16 Cust", "email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, r.text
    return {"email": email, "password": pwd, "token": r.json()["token"], "id": r.json()["user"]["id"]}


@pytest.fixture(scope="session")
def delivery_token():
    email = f"test_it16_dp_{STAMP}_{WORKER}@example.com"
    pwd = "Deliver@123"
    h = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
    db.users.insert_one({"name": "TEST It16 DP", "email": email, "password_hash": h, "role": "delivery", "created_at": "2026-07-01T00:00:00+00:00"})
    return login(email, pwd)


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    db.users.delete_many({"email": {"$regex": f"^(?i)test_it16_.*{STAMP}_{WORKER}"}})
    db.categories.delete_many({"slug": {"$regex": f"^test-it16-.*{WORKER}"}})
    db.orders.delete_many({"user_email": {"$regex": f"^(?i)test_it16_.*{STAMP}_{WORKER}"}})
    db.password_resets.delete_many({"email": {"$regex": f"^(?i)test_it16_"}})


# ---------------------------------------------------------------- forgot password
class TestForgotPassword:
    def test_forgot_password_known_email(self, customer):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True
        rec = db.password_resets.find_one({"email": customer["email"].lower()})
        assert rec is not None, "no password_resets record created"
        assert re.fullmatch(r"\d{6}", rec["code"]), f"code not 6 digits: {rec.get('code')}"

    def test_forgot_password_unknown_email_no_enumeration(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"TEST_it16_nobody_{STAMP}_{WORKER}@example.com"}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_reset_password_wrong_code(self, customer):
        requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]}, timeout=60)
        r = requests.post(f"{API}/auth/reset-password", json={"email": customer["email"], "code": "000000", "new_password": "NewPass@123"}, timeout=30)
        assert r.status_code == 400, r.text
        assert "Invalid or expired code" in r.json().get("detail", "")

    def test_reset_password_lockout_after_5_attempts(self, customer):
        requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]}, timeout=60)
        details = []
        for _ in range(6):
            r = requests.post(f"{API}/auth/reset-password", json={"email": customer["email"], "code": "111111", "new_password": "NewPass@123"}, timeout=30)
            assert r.status_code == 400
            details.append(r.json().get("detail", ""))
        assert "Too many attempts" in details[-1], f"expected lockout, got {details}"

    def test_reset_password_valid_code_end_to_end(self, customer):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]}, timeout=60)
        assert r.status_code == 200
        rec = db.password_resets.find_one({"email": customer["email"].lower()})
        code = rec["code"]
        new_pwd = "Reset@12345"
        r = requests.post(f"{API}/auth/reset-password", json={"email": customer["email"], "code": code, "new_password": new_pwd}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True
        # record consumed
        assert db.password_resets.find_one({"email": customer["email"].lower()}) is None
        # new password works
        tok = login(customer["email"], new_pwd)
        assert tok
        # old password rejected
        r2 = requests.post(f"{API}/auth/login", json={"email": customer["email"], "password": customer["password"]}, timeout=30)
        assert r2.status_code == 401
        customer["password"] = new_pwd
        customer["token"] = tok

    def test_bcrypt_hash_format(self, customer):
        u = db.users.find_one({"email": customer["email"].lower()})
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:6]


# ---------------------------------------------------------------- saved addresses
class TestSavedAddresses:
    def test_addresses_require_auth(self):
        r = requests.get(f"{API}/users/me/addresses", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_address_crud(self, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        payload = {
            "label": "Home", "full_name": "TEST It16", "phone": "9876543210",
            "line1": "12 Test Lane", "landmark": "Near Mandi", "area": "Mandi Bazar",
            "city": "Ambajogai", "pincode": "431517",
        }
        r = requests.post(f"{API}/users/me/addresses", json=payload, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created.get("id") and isinstance(created["id"], str)
        for k, v in payload.items():
            assert created[k] == v, f"{k}: {created.get(k)} != {v}"
        assert "_id" not in created

        r = requests.get(f"{API}/users/me/addresses", headers=h, timeout=30)
        assert r.status_code == 200
        lst = r.json()
        assert any(a["id"] == created["id"] and a["line1"] == payload["line1"] for a in lst)

        r = requests.delete(f"{API}/users/me/addresses/{created['id']}", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        lst = requests.get(f"{API}/users/me/addresses", headers=h, timeout=30).json()
        assert all(a["id"] != created["id"] for a in lst)

    def test_address_validation(self, customer):
        h = {"Authorization": f"Bearer {customer['token']}"}
        r = requests.post(f"{API}/users/me/addresses", json={"label": "Home"}, headers=h, timeout=30)
        assert r.status_code == 422, r.status_code


# ---------------------------------------------------------------- alert polling
class TestAlertPolling:
    def test_pending_count_requires_auth(self):
        r = requests.get(f"{API}/admin/orders/pending-count", timeout=30)
        assert r.status_code in (401, 403)

    def test_pending_count_forbidden_for_customer(self, customer):
        r = requests.get(f"{API}/admin/orders/pending-count", headers={"Authorization": f"Bearer {customer['token']}"}, timeout=30)
        assert r.status_code == 403, r.status_code

    def test_pending_count_admin(self, admin_token):
        r = requests.get(f"{API}/admin/orders/pending-count", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["count", "latest_id", "latest_created_at"]).issubset(d.keys())
        assert isinstance(d["count"], int) and d["count"] > 0
        assert isinstance(d["latest_id"], str)

    def test_delivery_new_count_role_enforced(self, customer, admin_token):
        for tok in (customer["token"], admin_token):
            r = requests.get(f"{API}/delivery/new-count", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
            assert r.status_code == 403, r.status_code

    def test_delivery_new_count(self, delivery_token):
        r = requests.get(f"{API}/delivery/new-count", headers={"Authorization": f"Bearer {delivery_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["count", "latest_id", "latest_created_at"]).issubset(d.keys())
        assert d["count"] == 0 and d["latest_id"] is None


# ---------------------------------------------------------------- delivery fee
def _item(p, qty):
    return {
        "product_id": str(p["_id"]), "name": p["name"], "price": float(p["price"]),
        "quantity": qty, "image": p["image"], "unit": p.get("unit", "1 pc"),
    }


def _restore_stock(item):
    db.products.update_one({"_id": ObjectId(item["product_id"])}, {"$inc": {"stock": item["quantity"]}})


def _place_order(token, items, distance_km):
    return requests.post(f"{API}/orders", json={
        "items": items,
        "address": {"full_name": "TEST It16", "phone": "9876543210", "line1": "12 Test Lane",
                    "area": "Mandi Bazar", "city": "Ambajogai", "pincode": "431517"},
        "payment_method": "COD",
        "distance_km": distance_km,
    }, headers={"Authorization": f"Bearer {token}"}, timeout=60)


class TestDeliveryFee:
    @pytest.fixture(scope="class")
    def cheap_item(self):
        p = db.products.find_one({"approval_status": "approved", "stock": {"$gt": 25}, "price": {"$lt": 45}})
        assert p, "no cheap product available"
        return _item(p, 1), float(p["price"])

    @pytest.mark.parametrize("dist,expected", [(1.0, 15.0), (3.0, 33.0), (5.0, 57.0)])
    def test_fee_by_distance(self, customer, cheap_item, dist, expected):
        item, price = cheap_item
        r = _place_order(customer["token"], [item], dist)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["delivery_fee"] == expected, f"dist {dist}: got {o['delivery_fee']}"
        assert o["total"] == round(o["subtotal"] + o["delivery_fee"] - o.get("discount", 0), 2)
        db.orders.delete_one({"_id": ObjectId(o["id"])})
        _restore_stock(item)

    def test_free_delivery_above_threshold(self, customer, cheap_item):
        item, price = cheap_item
        qty = int(499 // price) + 1
        r = _place_order(customer["token"], [{**item, "quantity": qty}], 5.0)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["subtotal"] >= 499, o["subtotal"]
        assert o["delivery_fee"] == 0.0, o["delivery_fee"]
        db.orders.delete_one({"_id": ObjectId(o["id"])})
        _restore_stock({**item, "quantity": qty})


# ---------------------------------------------------------------- strict status flow
class TestStrictStatusFlow:
    @pytest.fixture
    def pending_order_id(self, customer):
        p = db.products.find_one({"approval_status": "approved", "stock": {"$gt": 25}, "price": {"$lt": 45}})
        assert p, "no product with stock available for order tests"
        r = _place_order(customer["token"], [_item(p, 1)], 1.0)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        yield oid
        db.orders.delete_one({"_id": ObjectId(oid)})
        _restore_stock(_item(p, 1))

    def _patch(self, token, oid, status):
        return requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": status},
                              headers={"Authorization": f"Bearer {token}"}, timeout=30)

    def test_skip_step_rejected(self, admin_token, pending_order_id):
        r = self._patch(admin_token, pending_order_id, "Ready")
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == "Must move to next step: Accepted"

    def test_forward_one_step_and_backward_rejected(self, admin_token, pending_order_id):
        r = self._patch(admin_token, pending_order_id, "Accepted")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Accepted"
        # persistence check
        g = requests.get(f"{API}/orders/{pending_order_id}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        if g.status_code == 200:
            assert g.json()["status"] == "Accepted"
        # backward
        r = self._patch(admin_token, pending_order_id, "Pending")
        assert r.status_code == 400, r.text
        assert "Must move to next step" in r.json()["detail"] or "Invalid" in r.json()["detail"]
        # same status
        r = self._patch(admin_token, pending_order_id, "Accepted")
        assert r.status_code == 400 and "already Accepted" in r.json()["detail"]

    def test_cancel_allowed_pre_delivered(self, admin_token, pending_order_id):
        assert self._patch(admin_token, pending_order_id, "Accepted").status_code == 200
        r = self._patch(admin_token, pending_order_id, "Cancelled")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Cancelled"
        # cancelled cannot be updated
        r = self._patch(admin_token, pending_order_id, "Preparing")
        assert r.status_code == 400 and "Cancelled orders cannot be updated" in r.json()["detail"]

    def test_full_flow_then_locked_after_delivered(self, admin_token, pending_order_id):
        for s in ["Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered"]:
            r = self._patch(admin_token, pending_order_id, s)
            assert r.status_code == 200, f"{s}: {r.text}"
            assert r.json()["status"] == s
        r = self._patch(admin_token, pending_order_id, "Cancelled")
        assert r.status_code == 400 and "Delivered orders cannot be cancelled" in r.json()["detail"]
        hist = [h["status"] for h in r.json().get("status_history", [])] if r.status_code == 200 else None
        del hist

    def test_status_requires_admin(self, customer, pending_order_id):
        r = self._patch(customer["token"], pending_order_id, "Accepted")
        assert r.status_code == 403, r.status_code


# ---------------------------------------------------------------- category image
class TestCategoryImage:
    def test_create_category_with_image(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        slug = f"test-it16-cat-{STAMP}-{WORKER}"
        img = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
        r = requests.post(f"{API}/categories", json={"name": f"TEST It16 Cat {STAMP} {WORKER}", "slug": slug, "image": img}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["image"] == img
        assert c.get("id") and "_id" not in c
        lst = requests.get(f"{API}/categories", timeout=30).json()
        found = [x for x in lst if x["slug"] == slug]
        assert found and found[0]["image"] == img
        assert requests.delete(f"{API}/categories/{c['id']}", headers=h, timeout=30).status_code == 200

    def test_create_category_requires_admin(self, customer):
        r = requests.post(f"{API}/categories", json={"name": "X", "slug": f"test-it16-x-{STAMP}-{WORKER}", "image": "https://x.com/a.jpg"},
                          headers={"Authorization": f"Bearer {customer['token']}"}, timeout=30)
        assert r.status_code == 403, r.status_code

    def test_upload_image_endpoint_exists(self, admin_token):
        # 1x1 png
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
                            "0d0a2db40000000049454e44ae426082")
        r = requests.post(f"{API}/upload/image", files={"file": ("t.png", png, "image/png")}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("url", "").startswith("https://")
