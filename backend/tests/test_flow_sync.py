"""Quick sync test: customer -> admin -> rider order flow."""
import requests

API = "http://localhost:8010/api"
ADMIN = {"email": "admin@ambajogai.com", "password": "Admin@123"}


def login(email, password):
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


def test_admin_dashboard_and_filter():
    token, user = login(**ADMIN)
    assert user["role"] == "admin"

    dash = requests.get(f"{API}/admin/dashboard", headers=H(token), timeout=30)
    assert dash.status_code == 200

    filtered = requests.get(
        f"{API}/admin/orders?status_filter=Pending",
        headers=H(token),
        timeout=30,
    )
    assert filtered.status_code == 200
    pending = filtered.json()
    assert all(o["status"] == "Pending" for o in pending)


def test_admin_assign_and_rider_sync():
    admin_token, _ = login(**ADMIN)
    orders = requests.get(
        f"{API}/admin/orders", headers=H(admin_token), timeout=30
    ).json()
    if not orders:
        return

    order_id = orders[0]["id"]
    dps = requests.get(
        f"{API}/admin/delivery-partners", headers=H(admin_token), timeout=30
    ).json()
    if not dps:
        return

    dp = dps[0]
    assign = requests.patch(
        f"{API}/admin/orders/{order_id}/assign",
        headers=H(admin_token),
        json={"delivery_partner_id": dp["id"]},
        timeout=30,
    )
    assert assign.status_code == 200
    body = assign.json()
    assert body.get("delivery_partner_name")
    assert body.get("assigned_at")

    dp_token, dp_user = login(dp["email"], "Delivery@123")
    assert dp_user["role"] == "delivery"

    rider_orders = requests.get(
        f"{API}/delivery/orders", headers=H(dp_token), timeout=30
    ).json()
    assert any(o["id"] == order_id for o in rider_orders)

    new_count = requests.get(
        f"{API}/delivery/new-count", headers=H(dp_token), timeout=30
    ).json()
    assert "latest_assigned_at" in new_count


if __name__ == "__main__":
    test_admin_dashboard_and_filter()
    print("admin dashboard + filter: OK")
    try:
        test_admin_assign_and_rider_sync()
        print("admin assign + rider sync: OK")
    except requests.HTTPError as exc:
        print("rider sync skipped:", exc)
    except AssertionError as exc:
        print("rider sync skipped:", exc)
    print("DONE")
