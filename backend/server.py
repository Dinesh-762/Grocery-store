from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "7"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Ambajogai Grocery Store API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ambajogai")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat()


def oid_str(v) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(oid_str)]


# ---------------------------------------------------------------------------
# Auth utils
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


security = HTTPBearer(auto_error=False)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str = "customer"
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    code: str


class CategoryIn(BaseModel):
    name: str
    slug: str
    image: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(CategoryIn):
    id: str


class ProductIn(BaseModel):
    name: str
    slug: str
    description: str = ""
    price: float
    mrp: Optional[float] = None
    unit: str = "1 pc"
    category_slug: str
    image: str
    stock: int = 0
    featured: bool = False
    popular: bool = False


class ProductOut(ProductIn):
    id: str
    created_at: str


class AddressIn(BaseModel):
    full_name: str
    phone: str
    line1: str
    landmark: Optional[str] = ""
    area: str
    city: str = "Ambajogai"
    pincode: str


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    image: str
    unit: str


class OrderIn(BaseModel):
    items: List[OrderItem]
    address: AddressIn
    payment_method: str  # "UPI" or "COD"
    notes: Optional[str] = ""


ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Out For Delivery", "Delivered", "Cancelled"]


class OrderStatusUpdate(BaseModel):
    status: str


class ReviewIn(BaseModel):
    product_slug: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: str
    author_name: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def user_to_out(u: dict) -> dict:
    return {
        "id": str(u["_id"]) if "_id" in u else u.get("id"),
        "name": u["name"],
        "email": u["email"],
        "phone": u.get("phone"),
        "role": u.get("role", "customer"),
        "created_at": u.get("created_at", iso_now()),
    }


def product_to_out(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "name": p["name"],
        "slug": p["slug"],
        "description": p.get("description", ""),
        "price": p["price"],
        "mrp": p.get("mrp"),
        "unit": p.get("unit", "1 pc"),
        "category_slug": p["category_slug"],
        "image": p["image"],
        "stock": p.get("stock", 0),
        "featured": p.get("featured", False),
        "popular": p.get("popular", False),
        "created_at": p.get("created_at", iso_now()),
    }


def category_to_out(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "name": c["name"],
        "slug": c["slug"],
        "image": c.get("image"),
        "description": c.get("description"),
    }


def order_to_out(o: dict) -> dict:
    return {
        "id": str(o["_id"]),
        "user_id": o.get("user_id"),
        "user_email": o.get("user_email"),
        "user_name": o.get("user_name"),
        "items": o["items"],
        "address": o["address"],
        "payment_method": o["payment_method"],
        "notes": o.get("notes", ""),
        "subtotal": o["subtotal"],
        "delivery_fee": o["delivery_fee"],
        "total": o["total"],
        "status": o["status"],
        "status_history": o.get("status_history", []),
        "created_at": o.get("created_at", iso_now()),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@api.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "created_at": iso_now(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_token(str(res.inserted_id), email, "customer")
    return {"token": token, "user": user_to_out(doc)}


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(str(user["_id"]), email, user.get("role", "customer"))
    return {"token": token, "user": user_to_out(user)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


# Mock OTP: generate 6-digit code stored server-side (for demo, returned in response)
@api.post("/auth/otp/request")
async def otp_request(payload: OTPRequest):
    code = str(uuid.uuid4().int)[-6:]
    await db.otps.update_one(
        {"phone": payload.phone},
        {"$set": {"code": code, "expires_at": (now_utc() + timedelta(minutes=5)).isoformat()}},
        upsert=True,
    )
    logger.info(f"[MOCK OTP] phone={payload.phone} code={code}")
    return {"success": True, "message": "OTP sent (mock)", "debug_code": code}


@api.post("/auth/otp/verify")
async def otp_verify(payload: OTPVerify):
    rec = await db.otps.find_one({"phone": payload.phone})
    if not rec or rec.get("code") != payload.code:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="OTP expired")
    await db.otps.delete_one({"phone": payload.phone})
    return {"success": True, "message": "OTP verified"}


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@api.get("/categories", response_model=List[CategoryOut])
async def list_categories():
    docs = await db.categories.find().sort("name", 1).to_list(200)
    return [category_to_out(d) for d in docs]


@api.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryIn, _: dict = Depends(require_admin)):
    exists = await db.categories.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = payload.model_dump()
    res = await db.categories.insert_one(doc)
    doc["_id"] = res.inserted_id
    return category_to_out(doc)


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(cat_id)
    res = await db.categories.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@api.get("/products", response_model=List[ProductOut])
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    popular: Optional[bool] = None,
    limit: int = 100,
):
    query: dict = {}
    if category:
        query["category_slug"] = category
    if featured is not None:
        query["featured"] = featured
    if popular is not None:
        query["popular"] = popular
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"name": regex}, {"description": regex}]
    docs = await db.products.find(query).limit(limit).to_list(limit)
    return [product_to_out(d) for d in docs]


@api.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    doc = await db.products.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_out(doc)


@api.post("/products", response_model=ProductOut)
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    exists = await db.products.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = payload.model_dump()
    doc["created_at"] = iso_now()
    res = await db.products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return product_to_out(doc)


@api.put("/products/{prod_id}", response_model=ProductOut)
async def update_product(prod_id: str, payload: ProductIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(prod_id)
    await db.products.update_one({"_id": oid}, {"$set": payload.model_dump()})
    doc = await db.products.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_out(doc)


@api.delete("/products/{prod_id}")
async def delete_product(prod_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(prod_id)
    res = await db.products.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

DELIVERY_FEE = 30.0
FREE_DELIVERY_THRESHOLD = 499.0


def safe_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id format")


@api.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Recompute prices server-side from DB and validate stock
    verified_items = []
    for it in payload.items:
        try:
            prod = await db.products.find_one({"_id": ObjectId(it.product_id)})
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid product id: {it.product_id}")
        if not prod:
            raise HTTPException(status_code=400, detail=f"Product not found: {it.name}")
        if it.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        if prod.get("stock", 0) < it.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {prod['name']}")
        verified_items.append({
            "product_id": str(prod["_id"]),
            "name": prod["name"],
            "price": prod["price"],
            "quantity": it.quantity,
            "image": prod["image"],
            "unit": prod.get("unit", "1 pc"),
        })

    subtotal = round(sum(i["price"] * i["quantity"] for i in verified_items), 2)
    delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    total = round(subtotal + delivery_fee, 2)
    status_history = [{"status": "Pending", "at": iso_now()}]
    doc = {
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "items": verified_items,
        "address": payload.address.model_dump(),
        "payment_method": payload.payment_method,
        "notes": payload.notes or "",
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total": total,
        "status": "Pending",
        "status_history": status_history,
        "created_at": iso_now(),
    }
    res = await db.orders.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Reduce stock (best effort)
    for it in verified_items:
        try:
            await db.products.update_one({"_id": ObjectId(it["product_id"])}, {"$inc": {"stock": -it["quantity"]}})
        except Exception:
            pass

    return order_to_out(doc)


@api.get("/orders/my")
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    return [order_to_out(d) for d in docs]


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    oid = safe_object_id(order_id)
    doc = await db.orders.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.get("role") != "admin" and doc.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return order_to_out(doc)


@api.get("/admin/orders")
async def admin_list_orders(_: dict = Depends(require_admin), status_filter: Optional[str] = None):
    q = {"status": status_filter} if status_filter else {}
    docs = await db.orders.find(q).sort("created_at", -1).to_list(1000)
    return [order_to_out(d) for d in docs]


@api.patch("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate, _: dict = Depends(require_admin)):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    oid = safe_object_id(order_id)
    doc = await db.orders.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    history = doc.get("status_history", [])
    history.append({"status": payload.status, "at": iso_now()})
    await db.orders.update_one(
        {"_id": oid},
        {"$set": {"status": payload.status, "status_history": history}},
    )
    doc["status"] = payload.status
    doc["status_history"] = history
    return order_to_out(doc)


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

@api.get("/reviews")
async def list_reviews(product_slug: Optional[str] = None, limit: int = 20):
    q = {"product_slug": product_slug} if product_slug else {}
    docs = await db.reviews.find(q).sort("created_at", -1).to_list(limit)
    return [
        {
            "id": str(d["_id"]),
            "product_slug": d.get("product_slug"),
            "rating": d["rating"],
            "comment": d["comment"],
            "author_name": d["author_name"],
            "created_at": d.get("created_at", iso_now()),
        }
        for d in docs
    ]


@api.post("/reviews")
async def create_review(payload: ReviewIn):
    doc = payload.model_dump()
    doc["created_at"] = iso_now()
    res = await db.reviews.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Admin: dashboard & customers
# ---------------------------------------------------------------------------

@api.get("/admin/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({"role": "customer"})
    pending_orders = await db.orders.count_documents({"status": "Pending"})
    delivered_orders = await db.orders.count_documents({"status": "Delivered"})

    # Revenue (delivered orders only)
    revenue_pipeline = [
        {"$match": {"status": "Delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    rev_docs = await db.orders.aggregate(revenue_pipeline).to_list(1)
    revenue = rev_docs[0]["total"] if rev_docs else 0

    # Low stock
    low_stock = await db.products.find({"stock": {"$lt": 5}}).limit(20).to_list(20)

    # Recent orders
    recent = await db.orders.find().sort("created_at", -1).limit(6).to_list(6)

    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_users": total_users,
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "revenue": round(revenue, 2),
        "low_stock": [product_to_out(p) for p in low_stock],
        "recent_orders": [order_to_out(o) for o in recent],
    }


@api.get("/admin/customers")
async def admin_customers(_: dict = Depends(require_admin)):
    docs = await db.users.find({"role": "customer"}).sort("created_at", -1).to_list(1000)
    return [
        {
            "id": str(d["_id"]),
            "name": d["name"],
            "email": d["email"],
            "phone": d.get("phone"),
            "created_at": d.get("created_at"),
        }
        for d in docs
    ]


# ---------------------------------------------------------------------------
# Public store info
# ---------------------------------------------------------------------------

@api.get("/store/info")
async def store_info():
    return {
        "name": os.environ.get("STORE_NAME", "Ambajogai Grocery Store"),
        "whatsapp": os.environ.get("STORE_WHATSAPP", "+919999999999"),
        "upi_id": os.environ.get("STORE_UPI_ID", "ambajogai@upi"),
        "upi_name": os.environ.get("STORE_UPI_NAME", "Ambajogai Grocery Store"),
        "address": "Main Road, Ambajogai, Maharashtra 431517",
        "email": "contact@ambajogai.com",
    }


@api.get("/")
async def root():
    return {"message": "Ambajogai Grocery Store API", "status": "healthy"}


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

SEED_CATEGORIES = [
    {"name": "Fruits & Vegetables", "slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=600&q=80"},
    {"name": "Dairy & Bakery", "slug": "dairy-bakery", "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&q=80"},
    {"name": "Staples & Grains", "slug": "staples-grains", "image": "https://images.unsplash.com/photo-1546702005-7f8e5aeab4a6?w=600&q=80"},
    {"name": "Spices & Masala", "slug": "spices-masala", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80"},
    {"name": "Snacks & Beverages", "slug": "snacks-beverages", "image": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80"},
    {"name": "Personal Care", "slug": "personal-care", "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80"},
]

SEED_PRODUCTS = [
    # Fruits & Vegetables
    {"name": "Fresh Tomato", "slug": "fresh-tomato", "price": 30, "mrp": 40, "unit": "1 kg", "category_slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80", "stock": 50, "featured": True, "popular": True, "description": "Farm-fresh red tomatoes, hand-picked daily."},
    {"name": "Onion", "slug": "onion", "price": 40, "mrp": 50, "unit": "1 kg", "category_slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1508747703725-719777637510?w=600&q=80", "stock": 80, "popular": True, "description": "Premium quality Nashik onions."},
    {"name": "Banana", "slug": "banana", "price": 50, "mrp": 60, "unit": "1 dozen", "category_slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80", "stock": 30, "featured": True, "description": "Ripe yellow bananas, rich in potassium."},
    {"name": "Apple - Shimla", "slug": "apple-shimla", "price": 180, "mrp": 220, "unit": "1 kg", "category_slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80", "stock": 25, "featured": True, "popular": True, "description": "Crisp red apples straight from Himachal orchards."},
    {"name": "Potato", "slug": "potato", "price": 25, "mrp": 30, "unit": "1 kg", "category_slug": "fruits-vegetables", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", "stock": 100, "description": "Fresh farm potatoes."},

    # Dairy
    {"name": "Amul Milk (Toned)", "slug": "amul-milk-toned", "price": 32, "mrp": 34, "unit": "500 ml", "category_slug": "dairy-bakery", "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&q=80", "stock": 60, "featured": True, "popular": True, "description": "Amul toned milk pouch, farm fresh."},
    {"name": "Paneer", "slug": "paneer", "price": 90, "mrp": 100, "unit": "200 g", "category_slug": "dairy-bakery", "image": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80", "stock": 20, "popular": True, "description": "Soft, fresh paneer perfect for curries."},
    {"name": "Amul Butter", "slug": "amul-butter", "price": 55, "mrp": 60, "unit": "100 g", "category_slug": "dairy-bakery", "image": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&q=80", "stock": 40, "description": "Classic Amul butter for your daily needs."},
    {"name": "Whole Wheat Bread", "slug": "whole-wheat-bread", "price": 45, "mrp": 50, "unit": "400 g", "category_slug": "dairy-bakery", "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80", "stock": 35, "description": "Freshly baked whole wheat bread."},

    # Staples
    {"name": "Basmati Rice", "slug": "basmati-rice", "price": 320, "mrp": 380, "unit": "5 kg", "category_slug": "staples-grains", "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80", "stock": 15, "featured": True, "popular": True, "description": "Premium long-grain basmati rice."},
    {"name": "Toor Dal", "slug": "toor-dal", "price": 165, "mrp": 190, "unit": "1 kg", "category_slug": "staples-grains", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80", "stock": 25, "popular": True, "description": "Fresh, unpolished toor dal."},
    {"name": "Aashirvaad Atta", "slug": "aashirvaad-atta", "price": 340, "mrp": 400, "unit": "5 kg", "category_slug": "staples-grains", "image": "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=600&q=80", "stock": 30, "featured": True, "description": "100% whole wheat atta for soft rotis."},
    {"name": "Sunflower Oil", "slug": "sunflower-oil", "price": 210, "mrp": 240, "unit": "1 L", "category_slug": "staples-grains", "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80", "stock": 40, "description": "Refined sunflower cooking oil."},

    # Spices
    {"name": "Turmeric Powder", "slug": "turmeric-powder", "price": 65, "mrp": 80, "unit": "200 g", "category_slug": "spices-masala", "image": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&q=80", "stock": 50, "description": "Pure haldi powder, ground fresh."},
    {"name": "Red Chilli Powder", "slug": "red-chilli-powder", "price": 85, "mrp": 100, "unit": "200 g", "category_slug": "spices-masala", "image": "https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=600&q=80", "stock": 40, "popular": True, "description": "Spicy red chilli powder."},
    {"name": "Garam Masala", "slug": "garam-masala", "price": 95, "mrp": 110, "unit": "100 g", "category_slug": "spices-masala", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80", "stock": 30, "featured": True, "description": "Aromatic blend of ground whole spices."},

    # Snacks
    {"name": "Parle-G Biscuits", "slug": "parle-g", "price": 10, "mrp": 12, "unit": "80 g", "category_slug": "snacks-beverages", "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80", "stock": 200, "popular": True, "description": "The classic glucose biscuit."},
    {"name": "Lay's Classic Salted", "slug": "lays-classic", "price": 20, "mrp": 20, "unit": "52 g", "category_slug": "snacks-beverages", "image": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80", "stock": 100, "description": "Crispy potato chips."},
    {"name": "Tata Tea Gold", "slug": "tata-tea-gold", "price": 275, "mrp": 310, "unit": "500 g", "category_slug": "snacks-beverages", "image": "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&q=80", "stock": 25, "featured": True, "description": "Rich aroma and taste of premium tea."},

    # Personal care
    {"name": "Dettol Soap", "slug": "dettol-soap", "price": 40, "mrp": 45, "unit": "125 g", "category_slug": "personal-care", "image": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&q=80", "stock": 60, "description": "Antibacterial protection soap."},
    {"name": "Colgate Toothpaste", "slug": "colgate-toothpaste", "price": 95, "mrp": 110, "unit": "150 g", "category_slug": "personal-care", "image": "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=600&q=80", "stock": 45, "popular": True, "description": "Cavity protection for strong teeth."},
]


async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("slug", unique=True)
    await db.categories.create_index("slug", unique=True)

    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ambajogai.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "name": os.environ.get("ADMIN_NAME", "Store Admin"),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "phone": os.environ.get("STORE_WHATSAPP", ""),
            "created_at": iso_now(),
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
        )
        logger.info(f"Admin password refreshed: {admin_email}")

    # Categories
    for c in SEED_CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": c}, upsert=True)

    # Products
    for p in SEED_PRODUCTS:
        p_doc = {**p, "created_at": iso_now()}
        await db.products.update_one({"slug": p["slug"]}, {"$setOnInsert": p_doc}, upsert=True)

    # Reviews (seed a few if empty)
    if await db.reviews.count_documents({}) == 0:
        sample_reviews = [
            {"product_slug": None, "rating": 5, "comment": "Best grocery store in Ambajogai! Fresh vegetables delivered within 2 hours.", "author_name": "Rohit Deshmukh", "created_at": iso_now()},
            {"product_slug": None, "rating": 5, "comment": "Great prices and friendly staff. My family shops here every week.", "author_name": "Priya Kulkarni", "created_at": iso_now()},
            {"product_slug": None, "rating": 4, "comment": "Wide product range and reliable delivery. Highly recommended.", "author_name": "Sameer Patil", "created_at": iso_now()},
        ]
        await db.reviews.insert_many(sample_reviews)

    logger.info("Seed data loaded.")


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_data()


@app.on_event("shutdown")
async def shutdown():
    client.close()
