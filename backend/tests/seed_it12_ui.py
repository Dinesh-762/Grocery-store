"""Seed a product with variants for iteration-12 UI testing (idempotent)."""
import os

import requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"

tok = requests.post(f"{API}/auth/login", json={"email": "admin@ambajogai.com", "password": "Admin@123"}, timeout=30).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
cat = requests.get(f"{API}/categories", timeout=30).json()[0]["slug"]

SLUG = "test-it12-ui-variant-product"
payload = {
    "name": "TEST It12 UI Variant Dal",
    "slug": SLUG,
    "description": "Variant + note UI test product",
    "price": 60.0,
    "mrp": 80.0,
    "unit": "500 g",
    "category_slug": cat,
    "image": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    "stock": 999,
    "featured": True,
    "variants": [
        {"label": "500g", "price": 60.0, "unit": "500 g"},
        {"label": "1kg", "price": 110.0, "unit": "1 kg"},
    ],
}
existing = requests.get(f"{API}/products/{SLUG}", timeout=30)
if existing.status_code == 200:
    pid = existing.json()["id"]
    r = requests.put(f"{API}/products/{pid}", json=payload, headers=H, timeout=30)
else:
    r = requests.post(f"{API}/products", json=payload, headers=H, timeout=30)
print(r.status_code, r.text[:300])
print("slug:", SLUG)
