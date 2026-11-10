"""Quick verification of critical QA fixes against a running local backend."""
import math
import uuid
import requests

BASE = "http://127.0.0.1:8010/api"
CENTER_LAT = 18.735994
CENTER_LNG = 76.3891403


def coords_at_km(km: float) -> tuple[float, float]:
    """Approximate point km north of store center."""
    return CENTER_LAT + (km / 111.0), CENTER_LNG


def login_customer():
    email = f"qa_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE}/auth/register",
        json={"name": "QA User", "email": email, "password": "Test@1234", "phone": "9876543210"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"], email


def admin_token():
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": "admin@ambajogai.com", "password": "Admin@123"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def pick_product(min_stock=5, max_price=400):
    prods = requests.get(f"{BASE}/products", timeout=30).json()
    for p in prods:
        if p.get("stock", 0) >= min_stock and p["price"] <= max_price:
            return p
    raise RuntimeError("no suitable product")


def order_payload(product, qty=1, dist_km=1.0, payment="COD"):
    lat, lng = coords_at_km(dist_km)
    return {
        "items": [{
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": qty,
            "image": product["image"],
            "unit": product["unit"],
        }],
        "address": {
            "full_name": "QA Test",
            "phone": "9876543210",
            "line1": "Test Lane",
            "area": "Bazaar",
            "city": "Ambajogai",
            "pincode": "431517",
            "latitude": lat,
            "longitude": lng,
        },
        "payment_method": payment,
    }


def expected_total(subtotal, delivery_fee, discount=0):
    taxable_subtotal = max(0, subtotal - discount)
    platform_fee = 10.0 if taxable_subtotal > 0 else 0.0
    taxable_amount = round(taxable_subtotal + platform_fee + delivery_fee, 2)
    cgst = round(taxable_amount * 0.025, 2)
    sgst = round(taxable_amount * 0.025, 2)
    gst = round(cgst + sgst, 2)
    return round(taxable_amount + gst, 2)


def main():
    passed = 0
    cust_tok, _ = login_customer()
    adm_tok = admin_token()
    cust_h = {"Authorization": f"Bearer {cust_tok}"}
    adm_h = {"Authorization": f"Bearer {adm_tok}"}

    # 1. Payment method validation
    p = pick_product()
    bad = requests.post(f"{BASE}/orders", headers=cust_h, json={**order_payload(p), "payment_method": "FAKE"}, timeout=30)
    assert bad.status_code == 422, bad.text
    print("PASS payment_method validation")
    passed += 1

    # 2. Delivery fee + billing fields in response
    p = pick_product()
    qty = max(4, math.ceil(100 / p["price"]))
    stock_before = p["stock"]
    r = requests.post(f"{BASE}/orders", headers=cust_h, json=order_payload(p, qty=qty, dist_km=3.0), timeout=30)
    assert r.status_code == 200, r.text
    o = r.json()
    dist = o.get("distance_km", 0)
    exp_delivery = 15.0 if dist <= 1.5 else round(15 + (dist - 1.5) * 12, 2)
    assert o["delivery_fee"] == exp_delivery, (o["delivery_fee"], exp_delivery, dist)
    assert o.get("platform_fee") == 10.0, o
    assert o.get("gst") is not None, o
    assert o.get("distance_km") is not None, o
    exp_total = expected_total(o["subtotal"], o["delivery_fee"])
    assert o["total"] == exp_total, (o["total"], exp_total)
    print("PASS billing fields and delivery fee at 3km")
    passed += 1

    # 3. Stock decremented
    p2 = requests.get(f"{BASE}/products/{p['slug']}", timeout=30).json()
    assert p2["stock"] == stock_before - qty, (p2["stock"], stock_before, qty)
    print("PASS atomic stock decrement")
    passed += 1

    # 4. Cancel restores stock
    cancel = requests.patch(
        f"{BASE}/admin/orders/{o['id']}/status",
        headers=adm_h,
        json={"status": "Cancelled"},
        timeout=30,
    )
    assert cancel.status_code == 200, cancel.text
    p3 = requests.get(f"{BASE}/products/{p['slug']}", timeout=30).json()
    assert p3["stock"] == stock_before, (p3["stock"], stock_before)
    print("PASS stock restored on cancel")
    passed += 1

    # 5. Reviews require auth
    anon = requests.post(
        f"{BASE}/reviews",
        json={"product_slug": p["slug"], "rating": 5, "comment": "spam", "author_name": "Bot"},
        timeout=30,
    )
    assert anon.status_code == 401, anon.text
    ok = requests.post(
        f"{BASE}/reviews",
        headers=cust_h,
        json={"product_slug": p["slug"], "rating": 5, "comment": "Good", "author_name": "Ignored"},
        timeout=30,
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["author_name"] != "Ignored"
    print("PASS review auth")
    passed += 1

    # 6. Price manipulation rejected
    p6 = pick_product(min_stock=10)
    qty6 = max(4, math.ceil(100 / p6["price"]))
    tampered = order_payload(p6, qty=qty6)
    tampered["items"][0]["price"] = 1
    r6 = requests.post(f"{BASE}/orders", headers=cust_h, json=tampered, timeout=30)
    assert r6.status_code == 200, r6.text
    assert r6.json()["subtotal"] != 1
    print("PASS server-side price authority")
    passed += 1

    print(f"\nAll {passed} critical checks passed.")


if __name__ == "__main__":
    main()
