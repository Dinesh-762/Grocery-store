"""Iteration 10 — Commission, Delivery Boy Panel, Smart Assignment,
Admin Sales Analytics, Vendor Performance, WhatsApp helper.
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
TS = int(time.time())
DP = {"name": "TEST DP E2E", "email": f"dp_e2e_{TS}@example.com", "password": "Delivery@123",
      "phone": "9876500099", "vehicle": "Bike"}


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
def vendor_id(vendor_token):
    r = requests.get(f"{API}/vendors/me", headers=H(vendor_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    return r.json()["id"]


@pytest.fixture(scope="module")
def customer():
    p = {"name": "TEST It10 Cust", "email": f"TEST_it10_{TS}@example.com",
         "password": "Test@123", "phone": "9876500011"}
    r = requests.post(f"{API}/auth/register", json=p, timeout=30)
    assert r.status_code in (200, 201), r.text[:300]
    return {"token": r.json()["token"], "id": r.json()["user"]["id"], "email": p["email"]}


@pytest.fixture(scope="module")
def customer2():
    p = {"name": "TEST It10 Cust2", "email": f"TEST_it10b_{TS}@example.com",
         "password": "Test@123", "phone": "9876500012"}
    r = requests.post(f"{API}/auth/register", json=p, timeout=30)
    assert r.status_code in (200, 201), r.text[:300]
    return {"token": r.json()["token"]}


@pytest.fixture(scope="module")
def product(vendor_token):
    r = requests.get(f"{API}/vendor/products", headers=H(vendor_token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    prods = [p for p in r.json() if p.get("approved") is not False]
    assert prods, "no vendor product"
    p = max(prods, key=lambda x: x.get("stock", 0))
    if p.get("stock", 0) < 60:
        body = {k: p.get(k) for k in ("name", "slug", "description", "price", "mrp", "unit",
                                      "category_slug", "image", "featured", "popular")}
        body["stock"] = 500
        up = requests.put(f"{API}/vendor/products/{p['id']}", json=body,
                          headers=H(vendor_token), timeout=30)
        assert up.status_code == 200, f"restock failed {up.status_code} {up.text[:200]}"
        p = up.json()
    return p


def order_payload(prod, qty=1):
    return {
        "items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"],
                   "quantity": qty, "image": prod["image"], "unit": prod.get("unit", "1 pc")}],
        "address": {"full_name": "TEST It10", "phone": "9876500011", "line1": "1 Test Road",
                    "area": "Test Area", "city": "Ambajogai", "pincode": "431517"},
        "payment_method": "COD",
    }


def place_order(customer, prod, qty=1):
    r = requests.post(f"{API}/orders", json=order_payload(prod, qty),
                      headers=H(customer["token"]), timeout=30)
    assert r.status_code in (200, 201), f"order failed {r.status_code} {r.text[:300]}"
    return r.json()


@pytest.fixture(scope="module")
def dp(admin_token):
    r = requests.post(f"{API}/admin/delivery-partners", json=DP, headers=H(admin_token), timeout=30)
    assert r.status_code in (200, 201), f"create dp failed {r.status_code} {r.text[:300]}"
    d = r.json()
    d["token"] = login(DP["email"], DP["password"])["token"]
    yield d
    requests.delete(f"{API}/admin/delivery-partners/{d['id']}", headers=H(admin_token), timeout=30)


@pytest.fixture(scope="module", autouse=True)
def restore(admin_token, vendor_id, vendor_token):
    requests.patch(f"{API}/vendor/settings", json={"min_order_amount": 0, "open_now": True,
                                                   "vacation_mode": False},
                   headers=H(vendor_token), timeout=30)
    yield
    requests.patch(f"{API}/admin/vendors/{vendor_id}/commission", json={"commission_pct": 0},
                   headers=H(admin_token), timeout=30)
    requests.patch(f"{API}/vendor/settings", json={"min_order_amount": 100, "open_now": True,
                                                   "vacation_mode": False},
                   headers=H(vendor_token), timeout=30)


# ---------------- COMMISSION MGMT ----------------
class TestCommission:
    def test_admin_set_commission_persists(self, admin_token, vendor_id):
        r = requests.patch(f"{API}/admin/vendors/{vendor_id}/commission",
                           json={"commission_pct": 25}, headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["commission_pct"] == 25
        perf = requests.get(f"{API}/admin/vendors/performance", headers=H(admin_token), timeout=30)
        assert perf.status_code == 200
        row = [x for x in perf.json() if x["vendor_id"] == vendor_id]
        assert row and row[0]["commission_pct"] == 25, perf.text[:300]

    def test_commission_validation(self, admin_token, vendor_id):
        for bad in (-1, 95):
            r = requests.patch(f"{API}/admin/vendors/{vendor_id}/commission",
                               json={"commission_pct": bad}, headers=H(admin_token), timeout=30)
            assert r.status_code == 422, f"{bad} -> {r.status_code}"

    def test_commission_unknown_vendor_404(self, admin_token):
        r = requests.patch(f"{API}/admin/vendors/64b7f9a2c1e4d5a6b7c8d9e0/commission",
                           json={"commission_pct": 12}, headers=H(admin_token), timeout=30)
        assert r.status_code == 404, r.status_code

    def test_non_admin_forbidden(self, vendor_token, customer, vendor_id):
        for tok in (vendor_token, customer["token"]):
            r = requests.patch(f"{API}/admin/vendors/{vendor_id}/commission",
                               json={"commission_pct": 5}, headers=H(tok), timeout=30)
            assert r.status_code == 403, r.status_code
        r = requests.get(f"{API}/admin/vendors/performance", headers=H(customer["token"]), timeout=30)
        assert r.status_code == 403
        r = requests.get(f"{API}/admin/analytics", headers=H(customer["token"]), timeout=30)
        assert r.status_code == 403

    def test_vendor_cannot_set_own_commission(self, vendor_token, admin_token, vendor_id):
        r = requests.patch(f"{API}/vendor/settings", json={"commission_pct": 1},
                           headers=H(vendor_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        v = requests.get(f"{API}/vendors/me", headers=H(vendor_token), timeout=30).json()
        assert v["commission_pct"] == 25, f"vendor changed own commission -> {v['commission_pct']}"


# ---------------- VENDOR EARNINGS ----------------
class TestVendorEarnings:
    def test_earnings_breakdown_math(self, vendor_token):
        d = requests.get(f"{API}/vendor/analytics", headers=H(vendor_token), timeout=30).json()
        for k in ("total_sales", "pending_payment", "wallet"):
            assert k in d, f"missing {k}"
        assert d["total_sales"] >= 0
        assert d["pending_payment"] >= 0
        assert d["wallet"]["platform_fees"] == 0


# ---------------- DELIVERY PARTNER CRUD + AUTH ----------------
class TestDeliveryPartners:
    def test_create_and_list(self, admin_token, dp):
        assert dp["active"] is True and dp["email"] == DP["email"]
        lst = requests.get(f"{API}/admin/delivery-partners", headers=H(admin_token), timeout=30)
        assert lst.status_code == 200
        ids = [x["id"] for x in lst.json()]
        assert dp["id"] in ids
        assert all("_id" not in x for x in lst.json())

    def test_duplicate_email_rejected(self, admin_token, dp):
        r = requests.post(f"{API}/admin/delivery-partners", json=DP, headers=H(admin_token), timeout=30)
        assert r.status_code == 400, r.status_code

    def test_dp_login_role_and_me(self, dp):
        data = login(DP["email"], DP["password"])
        assert data["user"]["role"] == "delivery"
        me = requests.get(f"{API}/delivery/me", headers=H(dp["token"]), timeout=30)
        assert me.status_code == 200, me.text[:300]
        assert me.json()["email"] == DP["email"]
        e = requests.get(f"{API}/delivery/earnings", headers=H(dp["token"]), timeout=30)
        assert e.status_code == 200, e.text[:300]
        for k in ("total_deliveries", "today_earnings", "week_earnings", "month_earnings",
                  "total_earnings", "pending_earnings"):
            assert k in e.json(), k

    def test_non_delivery_forbidden(self, customer, admin_token):
        for ep in ("me", "orders", "history", "earnings"):
            r = requests.get(f"{API}/delivery/{ep}", headers=H(customer["token"]), timeout=30)
            assert r.status_code == 403, f"{ep} -> {r.status_code}"
        r = requests.get(f"{API}/admin/delivery-partners", headers=H(customer["token"]), timeout=30)
        assert r.status_code == 403

    def test_toggle_active_and_inactive_assignment(self, admin_token, dp, customer, product):
        order = place_order(customer, product, 1)
        r = requests.patch(f"{API}/admin/delivery-partners/{dp['id']}", json={"active": False},
                           headers=H(admin_token), timeout=30)
        assert r.status_code == 200 and r.json()["active"] is False, r.text[:300]
        a = requests.patch(f"{API}/admin/orders/{order['id']}/assign",
                           json={"delivery_partner_id": dp["id"]}, headers=H(admin_token), timeout=30)
        assert a.status_code == 400, f"inactive dp assignment -> {a.status_code}"
        r = requests.patch(f"{API}/admin/delivery-partners/{dp['id']}", json={"active": True},
                           headers=H(admin_token), timeout=30)
        assert r.json()["active"] is True

    def test_delete_unknown_dp_404(self, admin_token):
        r = requests.delete(f"{API}/admin/delivery-partners/64b7f9a2c1e4d5a6b7c8d9e0",
                            headers=H(admin_token), timeout=30)
        assert r.status_code == 404, r.status_code


# ---------------- ASSIGNMENT + DELIVERY STATUS E2E ----------------
class TestAssignmentFlow:
    def test_assign_and_deliver_end_to_end(self, admin_token, dp, customer, product):
        before_earn = requests.get(f"{API}/delivery/earnings", headers=H(dp["token"]), timeout=30).json()
        order = place_order(customer, product, 2)
        oid = order["id"]

        a = requests.patch(f"{API}/admin/orders/{oid}/assign",
                           json={"delivery_partner_id": dp["id"], "earning": 30},
                           headers=H(admin_token), timeout=30)
        assert a.status_code == 200, a.text[:300]
        body = a.json()
        assert body["delivery_partner_id"] == dp["id"]
        assert body["delivery_partner_name"] == DP["name"]
        assert body["delivery_boy_earning"] == 30

        active = requests.get(f"{API}/delivery/orders", headers=H(dp["token"]), timeout=30)
        assert active.status_code == 200
        assert oid in [o["id"] for o in active.json()]

        # invalid status
        bad = requests.patch(f"{API}/delivery/orders/{oid}/status", json={"status": "Packed"},
                             headers=H(dp["token"]), timeout=30)
        assert bad.status_code == 400, bad.status_code

        ofd = requests.patch(f"{API}/delivery/orders/{oid}/status",
                             json={"status": "Out For Delivery"}, headers=H(dp["token"]), timeout=30)
        assert ofd.status_code == 200, ofd.text[:300]
        assert ofd.json()["status"] == "Out For Delivery"

        dl = requests.patch(f"{API}/delivery/orders/{oid}/status", json={"status": "Delivered"},
                            headers=H(dp["token"]), timeout=30)
        assert dl.status_code == 200, dl.text[:300]
        assert dl.json()["status"] == "Delivered"
        assert all(i["line_status"] == "Delivered" for i in dl.json()["items"])

        active2 = requests.get(f"{API}/delivery/orders", headers=H(dp["token"]), timeout=30).json()
        assert oid not in [o["id"] for o in active2]
        hist = requests.get(f"{API}/delivery/history", headers=H(dp["token"]), timeout=30)
        assert hist.status_code == 200
        assert oid in [o["id"] for o in hist.json()]

        after_earn = requests.get(f"{API}/delivery/earnings", headers=H(dp["token"]), timeout=30).json()
        assert after_earn["total_earnings"] == pytest.approx(before_earn["total_earnings"] + 30, abs=0.05)
        assert after_earn["total_deliveries"] == before_earn["total_deliveries"] + 1
        assert after_earn["today_earnings"] >= 30

    def test_unassigned_order_404(self, dp, customer, product):
        order = place_order(customer, product, 1)
        r = requests.patch(f"{API}/delivery/orders/{order['id']}/status",
                           json={"status": "Delivered"}, headers=H(dp["token"]), timeout=30)
        assert r.status_code == 404, r.status_code

    def test_assign_unknown_dp_and_order(self, admin_token, dp, customer, product):
        order = place_order(customer, product, 1)
        r = requests.patch(f"{API}/admin/orders/{order['id']}/assign",
                           json={"delivery_partner_id": "64b7f9a2c1e4d5a6b7c8d9e0"},
                           headers=H(admin_token), timeout=30)
        assert r.status_code == 404, r.status_code
        r2 = requests.patch(f"{API}/admin/orders/64b7f9a2c1e4d5a6b7c8d9e0/assign",
                            json={"delivery_partner_id": dp["id"]}, headers=H(admin_token), timeout=30)
        assert r2.status_code == 404, r2.status_code

    def test_default_earning_applied(self, admin_token, dp, customer, product):
        order = place_order(customer, product, 1)
        r = requests.patch(f"{API}/admin/orders/{order['id']}/assign",
                           json={"delivery_partner_id": dp["id"]}, headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["delivery_boy_earning"] > 0


# ---------------- ADMIN ANALYTICS MATH ----------------
class TestAdminAnalytics:
    def test_shape(self, admin_token):
        r = requests.get(f"{API}/admin/analytics?days=14", headers=H(admin_token), timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("total_revenue", "platform_commission_earned", "total_vendor_payout",
                  "top_vendors", "top_products", "daily_trend"):
            assert k in d, k
        assert len(d["daily_trend"]) == 14
        assert len(d["top_vendors"]) <= 5 and len(d["top_products"]) <= 5
        assert all(set(("date", "orders", "revenue")) <= set(t) for t in d["daily_trend"])

    def test_vendor_gets_full_payout(self, admin_token, vendor_token, vendor_id, customer, product):
        before = requests.get(f"{API}/admin/analytics", headers=H(admin_token), timeout=60).json()
        o1 = place_order(customer, product, 2)
        line_total = round(product["price"] * 2, 2)
        r = requests.patch(f"{API}/vendor/orders/{o1['id']}/line-status", json={"status": "Delivered"},
                           headers=H(vendor_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        mid = requests.get(f"{API}/admin/analytics", headers=H(admin_token), timeout=60).json()
        assert mid["platform_commission_earned"] == pytest.approx(before["platform_commission_earned"], abs=0.01)
        assert mid["total_revenue"] == pytest.approx(before["total_revenue"] + o1["total"], abs=0.1)
        assert mid["total_vendor_payout"] == pytest.approx(
            before["total_vendor_payout"] + line_total, abs=0.1)

        o2 = place_order(customer, product, 1)
        line_total2 = round(product["price"] * 1, 2)
        requests.patch(f"{API}/vendor/orders/{o2['id']}/line-status", json={"status": "Delivered"},
                       headers=H(vendor_token), timeout=30)
        after = requests.get(f"{API}/admin/analytics", headers=H(admin_token), timeout=60).json()
        top_mid = [v for v in mid["top_vendors"] if v["vendor_id"] == vendor_id]
        top_after = [v for v in after["top_vendors"] if v["vendor_id"] == vendor_id]
        assert top_mid and top_after, "test vendor missing from top_vendors"
        vm, va = top_mid[0], top_after[0]
        assert va["gross"] == pytest.approx(vm["gross"] + line_total2, abs=0.1)
        assert va["commission"] == pytest.approx(0, abs=0.01)
        assert va["net_payout"] == pytest.approx(va["gross"], abs=0.1)
        assert after["platform_commission_earned"] == pytest.approx(
            before["platform_commission_earned"], abs=0.01)


# ---------------- VENDOR PERFORMANCE ----------------
class TestVendorPerformance:
    def test_fields_and_completion_math(self, admin_token, vendor_id):
        r = requests.get(f"{API}/admin/vendors/performance", headers=H(admin_token), timeout=60)
        assert r.status_code == 200, r.text[:300]
        rows = r.json()
        assert isinstance(rows, list) and rows
        keys = {"business_name", "commission_pct", "avg_rating", "review_count", "total_orders",
                "delivered_orders", "cancelled_orders", "completion_rate", "gross_sales",
                "vacation_mode", "open_now"}
        for row in rows:
            assert keys <= set(row), f"missing {keys - set(row)}"
            if row["total_orders"]:
                assert row["completion_rate"] == pytest.approx(
                    round(row["delivered_orders"] / row["total_orders"] * 100, 1), abs=0.15)
            else:
                assert row["completion_rate"] == 0.0
        assert vendor_id in [x["vendor_id"] for x in rows]


# ---------------- WHATSAPP HELPER RBAC ----------------
class TestWhatsApp:
    @pytest.fixture(scope="class")
    def wa_order(self, customer, product, admin_token, dp):
        o = place_order(customer, product, 1)
        requests.patch(f"{API}/admin/orders/{o['id']}/assign", json={"delivery_partner_id": dp["id"]},
                       headers=H(admin_token), timeout=30)
        return o

    def test_events_and_url(self, admin_token, wa_order):
        for ev in ("placed", "accepted", "dispatched", "delivered", "payment", "update"):
            r = requests.post(f"{API}/notify/order-whatsapp",
                              json={"order_id": wa_order["id"], "event": ev},
                              headers=H(admin_token), timeout=30)
            assert r.status_code == 200, f"{ev} -> {r.status_code} {r.text[:200]}"
            d = r.json()
            assert d["url"].startswith("https://wa.me/91"), d["url"]
            assert wa_order["id"][-6:].upper() in d["message"], d["message"]

    def test_missing_order_id_400_and_unknown_404(self, admin_token):
        r = requests.post(f"{API}/notify/order-whatsapp", json={"event": "placed"},
                          headers=H(admin_token), timeout=30)
        assert r.status_code == 400, r.status_code
        r2 = requests.post(f"{API}/notify/order-whatsapp",
                           json={"order_id": "64b7f9a2c1e4d5a6b7c8d9e0"}, headers=H(admin_token), timeout=30)
        assert r2.status_code == 404, r2.status_code

    def test_rbac(self, wa_order, customer, customer2, vendor_token, dp, admin_token):
        oid = wa_order["id"]
        own = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid, "event": "update"},
                            headers=H(customer["token"]), timeout=30)
        assert own.status_code == 200, own.text[:200]
        other = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid},
                              headers=H(customer2["token"]), timeout=30)
        assert other.status_code == 403, other.status_code
        v = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid, "event": "accepted"},
                          headers=H(vendor_token), timeout=30)
        assert v.status_code == 200, v.text[:200]
        d = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid, "event": "dispatched"},
                          headers=H(dp["token"]), timeout=30)
        assert d.status_code == 200, d.text[:200]
        # unauth
        na = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": oid}, timeout=30)
        assert na.status_code in (401, 403), na.status_code

    def test_delivery_unassigned_order_403(self, customer2, product, dp, customer):
        o = place_order(customer, product, 1)
        r = requests.post(f"{API}/notify/order-whatsapp", json={"order_id": o["id"]},
                          headers=H(dp["token"]), timeout=30)
        assert r.status_code == 403, r.status_code


# ---------------- TARGETED REGRESSION ----------------
class TestRegression:
    def test_storefront(self, vendor_id):
        r = requests.get(f"{API}/vendors/{vendor_id}", timeout=30)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        for k in ("business_name", "open_now", "vacation_mode"):
            assert k in d, k
        p = requests.get(f"{API}/products?vendor_id={vendor_id}", timeout=30)
        assert p.status_code == 200, p.text[:200]

    def test_business_hours_dotted(self, vendor_token):
        r = requests.patch(f"{API}/vendor/settings",
                           json={"business_hours": {"mon": "09:30-21:00"}},
                           headers=H(vendor_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["business_hours"]["mon"] == "09:30-21:00"
        assert "tue" in r.json()["business_hours"], "partial update wiped other days"

    def test_admin_orders_and_customers(self, admin_token):
        for ep in ("admin/orders", "admin/customers", "admin/dashboard", "admin/vendors"):
            r = requests.get(f"{API}/{ep}", headers=H(admin_token), timeout=60)
            assert r.status_code == 200, f"{ep} -> {r.status_code} {r.text[:200]}"

    def test_order_tracker_and_history(self, customer, product):
        o = place_order(customer, product, 1)
        r = requests.get(f"{API}/orders/{o['id']}", headers=H(customer["token"]), timeout=30)
        assert r.status_code == 200
        assert "status_history" in r.json() and r.json()["items"]
        lst = requests.get(f"{API}/orders/my", headers=H(customer["token"]), timeout=30)
        assert lst.status_code == 200 and any(x["id"] == o["id"] for x in lst.json())

    def test_coupons_public_list(self):
        r = requests.get(f"{API}/coupons", timeout=30)
        assert r.status_code in (200, 404), r.status_code
