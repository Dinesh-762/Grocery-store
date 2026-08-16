from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import re
import secrets
import hashlib
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import cloudinary
import cloudinary.uploader
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "7"))
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET")
)

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


async def require_delivery(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "delivery":
        raise HTTPException(status_code=403, detail="Delivery access required")
    return user


DEFAULT_COMMISSION_PCT = float(os.environ.get("DEFAULT_COMMISSION_PCT", "10"))
DEFAULT_DELIVERY_EARNING = float(os.environ.get("DEFAULT_DELIVERY_EARNING", "20"))


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


class ForgotPasswordRequest(BaseModel):
    phone: str


class PasswordResetOTPVerify(BaseModel):
    phone: str
    code: str


class PasswordResetConfirm(BaseModel):
    reset_token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=6, max_length=128)


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
    variants: Optional[List[dict]] = None  # [{label, price, unit}]


class ProductOut(ProductIn):
    id: str
    created_at: str
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    approval_status: str = "approved"  # approved | pending | rejected


class AddressIn(BaseModel):
    full_name: str
    phone: str
    line1: str
    landmark: Optional[str] = ""
    area: str
    city: str = "Ambajogai"
    pincode: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    image: str
    unit: str
    variant_label: Optional[str] = None
    note: Optional[str] = None


class OrderIn(BaseModel):
    items: List[OrderItem]
    address: AddressIn
    payment_method: str  # "UPI" or "COD"
    notes: Optional[str] = ""
    coupon_code: Optional[str] = None
    # Checkout also sends GPS at the top level. Keep both forms supported.
    latitude: Optional[float] = None
    longitude: Optional[float] = None


ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered", "Cancelled"]


class OrderStatusUpdate(BaseModel):
    status: str


class ReviewIn(BaseModel):
    product_slug: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: str
    author_name: str

# ---------------------------------------------------------------------------
# ORDER NOTIFICATION HELPERS
# ---------------------------------------------------------------------------

async def create_order_notification(
    user_id: str,
    order_id: str,
    title: str,
    message: str,
    notification_type: str = "order",
):
    """
    Store an in-app notification for a user.
    """

    notification = {
        "user_id": user_id,
        "order_id": str(order_id),
        "title": title,
        "message": message,
        "type": notification_type,
        "read": False,
        "created_at": iso_now(),
    }

    await db.notifications.insert_one(notification)


async def notify_order_users(
    order: dict,
    title: str,
    message: str,
    notification_type: str = "order",
):
    """
    Notify customer + vendor owners + assigned delivery boy.
    """

    order_id = str(order["_id"])

    notified_users = set()

    # ---------------------------------------------------------
    # CUSTOMER
    # ---------------------------------------------------------
    customer_id = order.get("user_id")

    if customer_id:
        notified_users.add(customer_id)

        await create_order_notification(
            user_id=customer_id,
            order_id=order_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )

    # ---------------------------------------------------------
    # VENDORS
    # ---------------------------------------------------------
    vendor_ids = set()# Helpers
    # --------------------------------------------------------------------------

    for item in order.get("items", []):
        vendor_id = item.get("vendor_id")

        if vendor_id:
            vendor_ids.add(vendor_id)

    for vendor_id in vendor_ids:

        vendor = await db.vendors.find_one({
            "id": vendor_id
        })

        if not vendor:
            try:
                vendor = await db.vendors.find_one({
                    "_id": safe_object_id(vendor_id)
                })
            except Exception:
                vendor = None

        if not vendor:
            continue

        owner_id = vendor.get("owner_id")

        if owner_id and owner_id not in notified_users:

            notified_users.add(owner_id)

            await create_order_notification(
                user_id=owner_id,
                order_id=order_id,
                title=title,
                message=message,
                notification_type=notification_type,
            )

    # ---------------------------------------------------------
    # DELIVERY BOY
    # ---------------------------------------------------------
    delivery_partner_id = order.get("delivery_partner_id")

    if delivery_partner_id and delivery_partner_id not in notified_users:

        await create_order_notification(
            user_id=delivery_partner_id,
            order_id=order_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )

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
        "vendor_id": p.get("vendor_id"),
        "vendor_name": p.get("vendor_name"),
        "approval_status": p.get("approval_status", "approved"),
        "variants": p.get("variants") or [],
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
        "delivery_distance_km": o.get("delivery_distance_km"),
        "discount": o.get("discount", 0),
        "coupon": o.get("coupon"),
        "total": o["total"],
        "status": o["status"],
        "status_history": o.get("status_history", []),
        "created_at": o.get("created_at", iso_now()),
        "delivery_partner_id": o.get("delivery_partner_id"),
        "delivery_partner_name": o.get("delivery_partner_name"),
        "delivery_boy_earning": o.get("delivery_boy_earning", 0),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@api.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        result = cloudinary.uploader.upload(
            contents,
            folder="grocery_products"
        )

        return {
            "url": result.get("secure_url")
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(e)}"
        )



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
    # Vendors must be approved (and not suspended/rejected) to log in
    if user.get("role") == "vendor":
        vendor = await db.vendors.find_one({"owner_id": str(user["_id"])})
        vstatus = vendor.get("status", "Pending") if vendor else "Pending"
        if vstatus == "Pending":
            raise HTTPException(status_code=403, detail="Your vendor application is pending admin approval.")
        if vstatus == "Rejected":
            raise HTTPException(status_code=403, detail="Your vendor application was rejected. Please contact support.")
        if vstatus == "Suspended":
            raise HTTPException(status_code=403, detail="Your vendor account is suspended. Please contact support.")
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


@api.post("/auth/password-reset/request")
async def password_reset_request(payload: ForgotPasswordRequest):
    phone = payload.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    # Keep the response generic in production to avoid account enumeration.
    user = await db.users.find_one({"phone": phone})
    code = f"{secrets.randbelow(1000000):06d}"

    if user:
        await db.password_reset_otps.update_one(
            {"phone": phone},
            {
                "$set": {
                    "code": code,
                    "expires_at": (now_utc() + timedelta(minutes=5)).isoformat(),
                    "attempts": 0,
                }
            },
            upsert=True,
        )
        logger.info(f"[PASSWORD RESET OTP] phone={phone} code={code}")

    response = {
        "success": True,
        "message": "If an account exists with this phone number, an OTP has been generated."
    }
    # Existing project uses mock OTPs. Keep the code available for local/dev testing,
    # but never expose it when APP_ENV=production.
    if os.environ.get("APP_ENV", "development").lower() != "production" and user:
        response["debug_code"] = code
    return response


@api.post("/auth/password-reset/verify")
async def password_reset_verify(payload: PasswordResetOTPVerify):
    phone = payload.phone.strip()
    rec = await db.password_reset_otps.find_one({"phone": phone})
    if not rec or rec.get("code") != payload.code:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        await db.password_reset_otps.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="OTP expired")

    user = await db.users.find_one({"phone": phone})
    if not user:
        await db.password_reset_otps.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="Invalid OTP")

    reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    await db.password_reset_tokens.update_one(
        {"phone": phone},
        {
            "$set": {
                "user_id": str(user["_id"]),
                "token_hash": token_hash,
                "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
            }
        },
        upsert=True,
    )
    await db.password_reset_otps.delete_one({"phone": phone})

    return {
        "success": True,
        "message": "OTP verified. You can now set a new password.",
        "reset_token": reset_token,
    }


@api.post("/auth/password-reset/confirm")
async def password_reset_confirm(payload: PasswordResetConfirm):
    token_hash = hashlib.sha256(payload.reset_token.encode()).hexdigest()
    rec = await db.password_reset_tokens.find_one({"token_hash": token_hash})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        await db.password_reset_tokens.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=400, detail="Reset token expired")

    try:
        user_oid = ObjectId(rec["user_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        await db.password_reset_tokens.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"_id": user_oid},
        {"$set": {"password_hash": hash_password(payload.new_password)}}
    )
    await db.password_reset_tokens.delete_one({"_id": rec["_id"]})

    return {"success": True, "message": "Password reset successfully. Please log in with your new password."}


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
    vendor_id: Optional[str] = None,
    limit: int = 100,
):
    # Public listing: only approved (legacy docs without the field are treated as approved)
    query: dict = {"$or": [{"approval_status": "approved"}, {"approval_status": {"$exists": False}}]}
    if category:
        query["category_slug"] = category
    if featured is not None:
        query["featured"] = featured
    if popular is not None:
        query["popular"] = popular
    if vendor_id:
        query["vendor_id"] = vendor_id
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        # combine text-search with the approval $or via $and
        query = {"$and": [query, {"$or": [{"name": regex}, {"description": regex}]}]}
    docs = await db.products.find(query).limit(limit).to_list(limit)
    return [product_to_out(d) for d in docs]


@api.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    doc = await db.products.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    if doc.get("approval_status", "approved") != "approved":
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_out(doc)


@api.post("/products", response_model=ProductOut)
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    exists = await db.products.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = payload.model_dump()
    doc["created_at"] = iso_now()
    doc["approval_status"] = "approved"  # admin-created products are pre-approved
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
# Orders / Delivery Pricing
# ---------------------------------------------------------------------------

# Delivery pricing requested for the grocery store:
# <= 1.5 km  -> ₹13 per km
# > 1.5 km   -> ₹20 per km
# Orders >= ₹499 keep the existing free-delivery rule.
DELIVERY_RATE_PER_KM = 13.0
DELIVERY_RATE_ABOVE_1_5_KM = 20.0
FREE_DELIVERY_THRESHOLD = 499.0
MINIMUM_ORDER_VALUE = 100.0
FREE_ORDER_LIMIT = 249.0
FREE_ORDER_REQUIRED_ORDERS = 13
PLATFORM_FEE = 10.0
CGST_RATE = 0.025
SGST_RATE = 0.025
GST_RATE = 0.05


def calculate_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Return great-circle distance between two GPS coordinates in km."""
    import math

    earth_radius_km = 6371.0
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lon / 2) ** 2
    )
    a = min(1.0, max(0.0, a))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(earth_radius_km * c, 2)


def calculate_delivery_fee(distance_km: float, subtotal: float = 0.0) -> float:
    """Calculate delivery fee using the configured distance bands."""
    if subtotal >= FREE_DELIVERY_THRESHOLD or distance_km <= 0:
        return 0.0
    if distance_km <= 1.5:
        return round(distance_km * DELIVERY_RATE_PER_KM, 2)
    return round(distance_km * DELIVERY_RATE_ABOVE_1_5_KM, 2)


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
    vendor_min_totals: dict = {}  # vendor_id -> subtotal
    for it in payload.items:
        try:
            prod = await db.products.find_one({"_id": ObjectId(it.product_id)})
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid product id: {it.product_id}")
        if not prod:
            raise HTTPException(status_code=400, detail=f"Product not found: {it.name}")
        if it.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")

        # Variant resolution — selected variant controls price/unit and, when present, stock.
        eff_price = float(prod["price"])
        eff_unit = prod.get("unit", "1 pc")
        selected_variant = None
        variant_has_own_stock = False
        if it.variant_label:
            variants = prod.get("variants") or []
            selected_variant = next((v for v in variants if v.get("label") == it.variant_label), None)
            if not selected_variant:
                raise HTTPException(status_code=400, detail=f"Unknown variant '{it.variant_label}' for {prod['name']}")
            eff_price = float(selected_variant.get("price", eff_price))
            eff_unit = selected_variant.get("unit", eff_unit)
            variant_has_own_stock = "stock" in selected_variant

        available_stock = (
            int(selected_variant.get("stock", 0))
            if variant_has_own_stock and selected_variant
            else int(prod.get("stock", 0))
        )
        if available_stock < it.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {prod['name']} ({it.variant_label or eff_unit})"
            )
        # Vacation-mode / open-now check per vendor
        vid = prod.get("vendor_id")
        if vid:
            try:
                vend = await db.vendors.find_one({"_id": ObjectId(vid)})
            except Exception:
                vend = None
            if vend and vend.get("vacation_mode"):
                raise HTTPException(status_code=400, detail=f"{vend.get('business_name', 'This vendor')} is temporarily closed. Please remove their items and try again.")
            if vend and vend.get("open_now") is False:
                raise HTTPException(status_code=400, detail=f"{vend.get('business_name', 'This vendor')} is not accepting orders right now.")
            vendor_min_totals[vid] = vendor_min_totals.get(vid, 0.0) + eff_price * it.quantity
        verified_items.append({
            "product_id": str(prod["_id"]),
            "name": prod["name"],
            "price": eff_price,
            "quantity": it.quantity,
            "image": prod["image"],
            "unit": eff_unit,
            "vendor_id": prod.get("vendor_id"),
            "vendor_name": prod.get("vendor_name"),
            "line_status": "Pending",
            "variant_label": it.variant_label,
            "note": (it.note or "").strip() or None,
        })

    # Enforce per-vendor min_order_amount
    for vid, sub in vendor_min_totals.items():
        try:
            vend = await db.vendors.find_one({"_id": ObjectId(vid)})
        except Exception:
            vend = None
        if vend:
            min_amt = vend.get("min_order_amount") or 0
            if min_amt and sub < min_amt:
                raise HTTPException(status_code=400, detail=f"Minimum order for {vend.get('business_name', 'this vendor')} is ₹{int(min_amt) if float(min_amt).is_integer() else round(min_amt, 2)}. Current subtotal for their items is ₹{sub:.2f}.")

    subtotal = round(sum(i["price"] * i["quantity"] for i in verified_items), 2)

     # Enforce minimum order value
    if subtotal < MINIMUM_ORDER_VALUE:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order value is ₹{MINIMUM_ORDER_VALUE}. Please add ₹{MINIMUM_ORDER_VALUE - subtotal:.2f} more to your cart."
        )

    # ---------------------------------------------------------------
    # Delivery distance
    # ---------------------------------------------------------------
    # Checkout currently sends GPS at the top level, while AddressIn also
    # supports latitude/longitude. Accept either form for compatibility.
    customer_lat = payload.latitude
    customer_lon = payload.longitude
    if customer_lat is None:
        customer_lat = payload.address.latitude
    if customer_lon is None:
        customer_lon = payload.address.longitude

    if customer_lat is None or customer_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Please allow location access so delivery charges can be calculated.",
        )

    # Determine the delivery distance from every vendor represented in the
    # order. For legacy/admin products without a vendor, use the main store
    # coordinates. For a multi-vendor order, the farthest vendor determines
    # the delivery charge so the customer is never undercharged.
    store_lat = float(
        os.environ.get(
            "STORE_LATITUDE",
            "18.7271336"
       )
   )

    store_lon = float(
        os.environ.get(
            "STORE_LONGITUDE",
            "76.3810922"
       )
   )
    vendor_locations = {}

    for item in verified_items:
        vendor_id = item.get("vendor_id")

        if not vendor_id:
            vendor_locations["__store__"] = (store_lat, store_lon)
            continue

        if vendor_id in vendor_locations:
            continue

        try:
            vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
        except Exception:
            vendor = None

        if not vendor:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor not found for {item.get('name', 'this product')}."
            )

        vendor_lat = vendor.get("latitude")
        vendor_lon = vendor.get("longitude")

        # Keep old vendor records working: if a vendor has not configured
        # GPS yet, fall back to the main store coordinates instead of making
        # every existing product impossible to order.
        if vendor_lat is None or vendor_lon is None:
            vendor_locations[vendor_id] = (store_lat, store_lon)
        else:
            vendor_locations[vendor_id] = (float(vendor_lat), float(vendor_lon))

    distances = [
        calculate_distance_km(v_lat, v_lon, float(customer_lat), float(customer_lon))
        for v_lat, v_lon in vendor_locations.values()
    ]

    distance_km = max(distances) if distances else 0.0
    delivery_fee = calculate_delivery_fee(distance_km, subtotal)

    # Store the coordinates actually used for this order so the admin/vendor
    # panels and future delivery tracking have the original location data.
    order_address = payload.address.model_dump()
    order_address["latitude"] = float(customer_lat)
    order_address["longitude"] = float(customer_lon)

    # Apply coupon if provided
    discount = 0.0
    coupon_applied = None
    if payload.coupon_code:
        code = payload.coupon_code.strip().upper()
        coupon = await db.coupons.find_one({"code": code, "active": True})
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")
        if coupon.get("expires_at") and datetime.fromisoformat(coupon["expires_at"]) < now_utc():
            raise HTTPException(status_code=400, detail="Coupon expired")
        if subtotal < coupon.get("min_amount", 0):
            raise HTTPException(status_code=400, detail=f"Order must be at least ₹{coupon.get('min_amount', 0)} to use this coupon")
        discount = round(subtotal * (coupon["discount_pct"] / 100.0), 2)
        coupon_applied = {"code": coupon["code"], "discount_pct": coupon["discount_pct"], "discount": discount}

    discounted_subtotal = max(0.0, subtotal - discount)

    platform_fee = PLATFORM_FEE if discounted_subtotal > 0 else 0.0

    taxable_amount = (
        discounted_subtotal
        + platform_fee
        + delivery_fee
    )

    cgst = round(taxable_amount * CGST_RATE, 2)
    sgst = round(taxable_amount * SGST_RATE, 2)
    gst = round(cgst + sgst, 2)

    total = round(
        discounted_subtotal
        + platform_fee
        + delivery_fee
        + gst,
        2
    )
    status_history = [{"status": "Pending", "at": iso_now()}]
    doc = {
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "items": verified_items,
        "address": order_address,
        "payment_method": payload.payment_method,
        "notes": payload.notes or "",
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "delivery_distance_km": distance_km,
        "discount": discount,
        "coupon": coupon_applied,
        "platform_fee": platform_fee,
        "cgst": cgst,
        "sgst": sgst,
        "gst": gst,
        "total": total,
        "status": "Pending",
        "status_history": status_history,
        "created_at": iso_now(),
    }
    # Reserve stock atomically before creating the order. If any reservation fails,
    # roll back reservations already made so we do not create an order that cannot be fulfilled.
    reservations = []
    try:
        for it in verified_items:
            product_oid = ObjectId(it["product_id"])
            reserved_variant = False

            if it.get("variant_label"):
                prod_now = await db.products.find_one({"_id": product_oid}, {"variants": 1})
                variants_now = (prod_now or {}).get("variants") or []
                variant_now = next((v for v in variants_now if v.get("label") == it["variant_label"]), None)
                if variant_now is not None and "stock" in variant_now:
                    result = await db.products.update_one(
                        {
                            "_id": product_oid,
                            "variants": {
                                "$elemMatch": {
                                    "label": it["variant_label"],
                                    "stock": {"$gte": it["quantity"]},
                                }
                            },
                        },
                        {"$inc": {"variants.$.stock": -it["quantity"]}},
                    )
                    if result.modified_count == 0:
                        raise HTTPException(status_code=409, detail=f"Stock changed for {it['name']}. Please refresh and try again.")
                    reservations.append({"product_id": product_oid, "quantity": it["quantity"], "variant_label": it["variant_label"]})
                    reserved_variant = True

            if not reserved_variant:
                result = await db.products.update_one(
                    {"_id": product_oid, "stock": {"$gte": it["quantity"]}},
                    {"$inc": {"stock": -it["quantity"]}},
                )
                if result.modified_count == 0:
                    raise HTTPException(status_code=409, detail=f"Stock changed for {it['name']}. Please refresh and try again.")
                reservations.append({"product_id": product_oid, "quantity": it["quantity"], "variant_label": None})

        res = await db.orders.insert_one(doc)
        doc["_id"] = res.inserted_id
    except Exception:
        # Best-effort rollback of all reservations made before the failure.
        for reservation in reservations:
            try:
                if reservation["variant_label"]:
                    await db.products.update_one(
                        {
                            "_id": reservation["product_id"],
                            "variants": {"$elemMatch": {"label": reservation["variant_label"]}},
                        },
                        {"$inc": {"variants.$.stock": reservation["quantity"]}},
                    )
                else:
                    await db.products.update_one(
                        {"_id": reservation["product_id"]},
                        {"$inc": {"stock": reservation["quantity"]}},
                    )
            except Exception as rollback_exc:
                logger.error(f"Stock rollback failed: {rollback_exc}")
        raise

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
      # ---------------------------------------------------------
      # CUSTOMER NOTIFICATIONS
      # ---------------------------------------------------------

    if payload.status == "Accepted":

          await create_order_notification(
              user_id=doc["user_id"],
              order_id=str(doc["_id"]),
              title="Order Accepted",
              message="Your order has been successfully accepted and is being prepared.",
              notification_type="order_accepted",
          )

    elif payload.status == "Delivered":

          await create_order_notification(
              user_id=doc["user_id"],
              order_id=str(doc["_id"]),
              title="Order Delivered",
              message="Your order has been delivered successfully. Thank you for shopping with us!",
              notification_type="order_delivered",
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
    total_vendors = await db.vendors.count_documents({"status": "Approved"})
    pending_vendors = await db.vendors.count_documents({"status": "Pending"})
    pending_products = await db.products.count_documents({"approval_status": "pending"})
    pending_orders = await db.orders.count_documents({"status": "Pending"})
    delivered_orders = await db.orders.count_documents({"status": "Delivered"})
    cancelled_orders = await db.orders.count_documents({"status": "Cancelled"})

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
        "total_vendors": total_vendors,
        "pending_vendors": pending_vendors,
        "pending_products": pending_products,
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "cancelled_orders": cancelled_orders,
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
# Vendors: signup, admin approval, vendor-only endpoints
# ---------------------------------------------------------------------------

VENDOR_STATUSES = ["Pending", "Approved", "Rejected", "Suspended"]


class VendorDocs(BaseModel):
    aadhar_url: Optional[str] = ""
    gst_url: Optional[str] = ""
    shop_license_url: Optional[str] = ""


class VendorRegisterIn(BaseModel):
    # user
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str
    # vendor profile
    business_name: str
    business_description: str = ""
    business_address: str
    business_pincode: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    docs: VendorDocs = VendorDocs()


class VendorStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = ""


class BusinessHoursIn(BaseModel):
    mon: Optional[str] = None
    tue: Optional[str] = None
    wed: Optional[str] = None
    thu: Optional[str] = None
    fri: Optional[str] = None
    sat: Optional[str] = None
    sun: Optional[str] = None


class VendorSettingsIn(BaseModel):
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_address: Optional[str] = None
    business_pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    shop_phone: Optional[str] = None
    shop_whatsapp: Optional[str] = None
    shop_logo: Optional[str] = None
    banner_image: Optional[str] = None
    business_hours: Optional[BusinessHoursIn] = None
    open_now: Optional[bool] = None
    vacation_mode: Optional[bool] = None
    vacation_message: Optional[str] = None
    delivery_radius_km: Optional[float] = None
    min_order_amount: Optional[float] = None
    estimated_delivery_min: Optional[int] = None
    commission_pct: Optional[float] = None  # admin-only path is enforced separately


def vendor_to_out(v: dict) -> dict:
    return {
        "id": str(v["_id"]),
        "owner_id": v.get("owner_id"),
        "owner_email": v.get("owner_email"),
        "owner_name": v.get("owner_name"),
        "phone": v.get("phone"),
        "business_name": v["business_name"],
        "business_description": v.get("business_description", ""),
        "business_address": v.get("business_address", ""),
        "business_pincode": v.get("business_pincode", ""),
        "latitude": v.get("latitude"),
        "longitude": v.get("longitude"),
        "docs": v.get("docs", {}),
        "status": v.get("status", "Pending"),
        "rejection_reason": v.get("rejection_reason", ""),
        "created_at": v.get("created_at"),
        "approved_at": v.get("approved_at"),
        # Business Center fields
        "shop_phone": v.get("shop_phone", v.get("phone", "")),
        "shop_whatsapp": v.get("shop_whatsapp", v.get("phone", "")),
        "shop_logo": v.get("shop_logo", ""),
        "banner_image": v.get("banner_image", ""),
        "business_hours": v.get("business_hours", {}),
        "open_now": v.get("open_now", True),
        "vacation_mode": v.get("vacation_mode", False),
        "vacation_message": v.get("vacation_message", ""),
        "delivery_radius_km": v.get("delivery_radius_km"),
        "min_order_amount": v.get("min_order_amount", 0),
        "estimated_delivery_min": v.get("estimated_delivery_min"),
        "verified": v.get("status") == "Approved",
        "commission_pct": v.get("commission_pct", DEFAULT_COMMISSION_PCT),
    }


async def get_vendor_for_user(user: dict) -> dict:
    if user.get("role") != "vendor":
        raise HTTPException(status_code=403, detail="Vendor access required")
    vendor = await db.vendors.find_one({"owner_id": user["id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    if vendor.get("status") != "Approved":
        raise HTTPException(status_code=403, detail=f"Vendor is {vendor.get('status', 'Pending')}")
    return vendor


@api.post("/vendors/register")
async def vendor_register(payload: VendorRegisterIn):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "vendor",
        "created_at": iso_now(),
    }
    ures = await db.users.insert_one(user_doc)
    vendor_doc = {
        "owner_id": str(ures.inserted_id),
        "owner_email": email,
        "owner_name": payload.name.strip(),
        "phone": payload.phone,
        "business_name": payload.business_name.strip(),
        "business_description": payload.business_description.strip(),
        "business_address": payload.business_address.strip(),
        "business_pincode": payload.business_pincode.strip(),
        "docs": payload.docs.model_dump(),
        "status": "Pending",
        "created_at": iso_now(),
    }
    vres = await db.vendors.insert_one(vendor_doc)
    vendor_doc["_id"] = vres.inserted_id
    return {
        "success": True,
        "message": "Vendor application submitted. You will be notified once the admin approves your account.",
        "vendor": vendor_to_out(vendor_doc),
    }


@api.get("/vendors/me")
async def vendor_me(user: dict = Depends(get_current_user)):
    if user.get("role") != "vendor":
        raise HTTPException(status_code=403, detail="Vendor access required")
    vendor = await db.vendors.find_one({"owner_id": user["id"]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return vendor_to_out(vendor)


# Public listing (approved vendors only)
@api.get("/vendors")
async def list_public_vendors():
    docs = await db.vendors.find({"status": "Approved"}).to_list(500)
    return [
        {"id": str(v["_id"]), "business_name": v["business_name"], "description": v.get("business_description", "")}
        for v in docs
    ]


@api.get("/vendors/{vendor_id}")
async def get_public_vendor(vendor_id: str):
    oid = safe_object_id(vendor_id)
    v = await db.vendors.find_one({"_id": oid, "status": "Approved"})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    products = await db.products.find({
        "vendor_id": str(oid),
        "approval_status": "approved",
    }).sort("created_at", -1).to_list(500)
    return {
        "id": str(v["_id"]),
        "business_name": v["business_name"],
        "business_description": v.get("business_description", ""),
        "business_address": v.get("business_address", ""),
        "business_pincode": v.get("business_pincode", ""),
        "shop_phone": v.get("shop_phone", v.get("phone", "")),
        "shop_whatsapp": v.get("shop_whatsapp", v.get("phone", "")),
        "shop_logo": v.get("shop_logo", ""),
        "banner_image": v.get("banner_image", ""),
        "business_hours": v.get("business_hours", {}),
        "open_now": v.get("open_now", True),
        "vacation_mode": v.get("vacation_mode", False),
        "vacation_message": v.get("vacation_message", ""),
        "delivery_radius_km": v.get("delivery_radius_km"),
        "min_order_amount": v.get("min_order_amount", 0),
        "estimated_delivery_min": v.get("estimated_delivery_min"),
        "verified": True,
        "created_at": v.get("created_at"),
        "products": [product_to_out(p) for p in products],
    }


# Admin: all vendors
@api.get("/admin/vendors")
async def admin_list_vendors(_: dict = Depends(require_admin), status_filter: Optional[str] = None):
    q = {"status": status_filter} if status_filter else {}
    docs = await db.vendors.find(q).sort("created_at", -1).to_list(1000)
    return [vendor_to_out(v) for v in docs]


@api.patch("/admin/vendors/{vendor_id}/status")
async def admin_update_vendor_status(vendor_id: str, payload: VendorStatusUpdate, _: dict = Depends(require_admin)):
    if payload.status not in VENDOR_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid vendor status")
    oid = safe_object_id(vendor_id)
    update_doc = {"status": payload.status}
    if payload.status == "Approved":
        update_doc["approved_at"] = iso_now()
        update_doc["rejection_reason"] = ""
    elif payload.status == "Rejected":
        update_doc["rejection_reason"] = payload.reason or ""
    res = await db.vendors.update_one({"_id": oid}, {"$set": update_doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor = await db.vendors.find_one({"_id": oid})
    # Also flag the products of a suspended/rejected vendor as hidden
    if payload.status in ("Rejected", "Suspended"):
        await db.products.update_many({"vendor_id": str(oid)}, {"$set": {"approval_status": "pending"}})
    return vendor_to_out(vendor)


# Vendor: my products
@api.get("/vendor/products")
async def vendor_my_products(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    docs = await db.products.find({"vendor_id": str(vendor["_id"])}).sort("created_at", -1).to_list(1000)
    return [product_to_out(p) for p in docs]


@api.post("/vendor/products", response_model=ProductOut)
async def vendor_create_product(payload: ProductIn, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    exists = await db.products.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = payload.model_dump()
    doc["created_at"] = iso_now()
    doc["vendor_id"] = str(vendor["_id"])
    doc["vendor_name"] = vendor["business_name"]
    doc["approval_status"] = "pending"  # new vendor products require admin approval
    res = await db.products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return product_to_out(doc)


@api.put("/vendor/products/{prod_id}", response_model=ProductOut)
async def vendor_update_product(prod_id: str, payload: ProductIn, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    oid = safe_object_id(prod_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing.get("vendor_id") != str(vendor["_id"]):
        raise HTTPException(status_code=403, detail="Not your product")
    await db.products.update_one({"_id": oid}, {"$set": payload.model_dump()})
    doc = await db.products.find_one({"_id": oid})
    return product_to_out(doc)


@api.delete("/vendor/products/{prod_id}")
async def vendor_delete_product(prod_id: str, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    oid = safe_object_id(prod_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing or existing.get("vendor_id") != str(vendor["_id"]):
        raise HTTPException(status_code=403, detail="Not your product")
    await db.products.delete_one({"_id": oid})
    return {"success": True}


# Admin: product approval
@api.get("/admin/products")
async def admin_list_products(_: dict = Depends(require_admin), status: Optional[str] = None):
    q: dict = {}
    if status:
        q["approval_status"] = status
    docs = await db.products.find(q).sort("created_at", -1).to_list(1000)
    return [product_to_out(p) for p in docs]


@api.patch("/admin/products/{prod_id}/approval")
async def admin_set_product_approval(prod_id: str, payload: dict, _: dict = Depends(require_admin)):
    status = payload.get("status")
    if status not in ("approved", "pending", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid approval status")
    oid = safe_object_id(prod_id)
    res = await db.products.update_one({"_id": oid}, {"$set": {"approval_status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    doc = await db.products.find_one({"_id": oid})
    return product_to_out(doc)


# Vendor: my orders (filtered to line items owned by this vendor)
@api.get("/vendor/orders")
async def vendor_my_orders(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    vid = str(vendor["_id"])
    docs = await db.orders.find({"items.vendor_id": vid}).sort("created_at", -1).to_list(1000)
    result = []
    for o in docs:
        my_items = [i for i in o["items"] if i.get("vendor_id") == vid]
        my_subtotal = round(sum(i["price"] * i["quantity"] for i in my_items), 2)
        line_statuses = list({i.get("line_status", "Pending") for i in my_items})
        my_status = line_statuses[0] if len(line_statuses) == 1 else "Mixed"
        result.append({
            "id": str(o["_id"]),
            "created_at": o.get("created_at"),
            "customer_name": o.get("user_name"),
            "customer_phone": o["address"]["phone"],
            "address": o["address"],
            "payment_method": o["payment_method"],
            "items": my_items,
            "my_subtotal": my_subtotal,
            "overall_status": o["status"],
            "my_status": my_status,
        })
    return result


@api.patch("/vendor/orders/{order_id}/line-status")
async def vendor_update_line_status(order_id: str, payload: dict, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    vid = str(vendor["_id"])
    new_status = payload.get("status")
    if new_status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    oid = safe_object_id(order_id)
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    updated_items = []
    touched = False
    for i in order["items"]:
        if i.get("vendor_id") == vid:
            i["line_status"] = new_status
            touched = True
        updated_items.append(i)
    if not touched:
        raise HTTPException(status_code=403, detail="No line items belong to your vendor account")

    # Derive overall status: lowest progress across all items (min-index in ORDER_STATUSES)
    order_index = {s: i for i, s in enumerate(ORDER_STATUSES)}
    line_statuses = [i.get("line_status", "Pending") for i in updated_items]
    if all(s == "Cancelled" for s in line_statuses):
        overall = "Cancelled"
    else:
        non_cancelled = [s for s in line_statuses if s != "Cancelled"]
        overall = min(non_cancelled, key=lambda s: order_index.get(s, 0)) if non_cancelled else "Pending"

    history = order.get("status_history", [])
    if overall != order["status"]:
        history.append({"status": overall, "at": iso_now(), "by": f"vendor:{vendor['business_name']}"})

    await db.orders.update_one(
        {"_id": oid},
        {"$set": {"items": updated_items, "status": overall, "status_history": history}},
    )
    order["items"] = updated_items
    order["status"] = overall
    order["status_history"] = history
    return order_to_out(order)


# Vendor dashboard stats
@api.get("/vendor/dashboard")
async def vendor_dashboard(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    vid = str(vendor["_id"])

    total_products = await db.products.count_documents({"vendor_id": vid})
    approved_products = await db.products.count_documents({"vendor_id": vid, "approval_status": "approved"})
    pending_products = await db.products.count_documents({"vendor_id": vid, "approval_status": "pending"})
    low_stock = await db.products.find({"vendor_id": vid, "stock": {"$lt": 5}}).limit(10).to_list(10)

    order_docs = await db.orders.find({"items.vendor_id": vid}).to_list(5000)
    total_orders = len(order_docs)
    revenue = 0.0
    pending_count = 0
    delivered_count = 0
    for o in order_docs:
        for i in o["items"]:
            if i.get("vendor_id") == vid:
                ls = i.get("line_status", "Pending")
                if ls == "Delivered":
                    revenue += i["price"] * i["quantity"]
                    delivered_count += 1
                elif ls == "Pending":
                    pending_count += 1

    return {
        "vendor": vendor_to_out(vendor),
        "total_products": total_products,
        "approved_products": approved_products,
        "pending_products": pending_products,
        "total_orders": total_orders,
        "pending_orders": pending_count,
        "delivered_orders": delivered_count,
        "revenue": round(revenue, 2),
        "low_stock": [product_to_out(p) for p in low_stock],
    }


# Vendor: shop settings (Business Center)
@api.get("/vendor/settings")
async def vendor_get_settings(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    return vendor_to_out(vendor)


@api.patch("/vendor/settings")
async def vendor_update_settings(payload: VendorSettingsIn, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    update = payload.model_dump(exclude_none=True)
    # Vendors cannot set their own commission — silently drop
    update.pop("commission_pct", None)
    if "min_order_amount" in update and update["min_order_amount"] < 0:
        raise HTTPException(status_code=400, detail="Min order must be >= 0")
    if "delivery_radius_km" in update and update["delivery_radius_km"] < 0:
        raise HTTPException(status_code=400, detail="Delivery radius must be >= 0")
    if "estimated_delivery_min" in update and update["estimated_delivery_min"] < 0:
        raise HTTPException(status_code=400, detail="ETA must be >= 0")
    if not update:
        return vendor_to_out(vendor)

    # business_hours: merge per-day keys via dotted paths so partial payloads don't wipe other days
    hours_update = None
    if "business_hours" in update and isinstance(update["business_hours"], dict):
        hours_update = {k: v for k, v in update["business_hours"].items() if v is not None}
        del update["business_hours"]
    set_doc = {**update}
    for day, val in (hours_update or {}).items():
        set_doc[f"business_hours.{day}"] = val
    await db.vendors.update_one({"_id": vendor["_id"]}, {"$set": set_doc})
    updated = await db.vendors.find_one({"_id": vendor["_id"]})
    return vendor_to_out(updated)


# Vendor: analytics
@api.get("/vendor/analytics")
async def vendor_analytics(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    vid = str(vendor["_id"])
    now = now_utc()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)

    all_orders = await db.orders.find({"items.vendor_id": vid}).sort("created_at", -1).to_list(5000)

    today_orders = 0
    week_orders = 0
    month_revenue = 0.0
    total_revenue = 0.0
    total_items_sold = 0
    product_stats: dict = {}

    for o in all_orders:
        try:
            created = datetime.fromisoformat(o["created_at"])
        except Exception:
            continue
        if created >= today_start:
            today_orders += 1
        if created >= week_start:
            week_orders += 1
        for i in o["items"]:
            if i.get("vendor_id") != vid:
                continue
            line_total = i["price"] * i["quantity"]
            ls = i.get("line_status", "Pending")
            if ls == "Delivered":
                total_revenue += line_total
                total_items_sold += i["quantity"]
                if created >= month_start:
                    month_revenue += line_total
                pid = i.get("product_id")
                if pid:
                    s = product_stats.setdefault(pid, {"product_id": pid, "name": i["name"], "image": i["image"], "unit": i.get("unit", ""), "qty": 0, "revenue": 0.0})
                    s["qty"] += i["quantity"]
                    s["revenue"] += line_total

    best_sellers = sorted(product_stats.values(), key=lambda s: s["revenue"], reverse=True)[:5]
    for s in best_sellers:
        s["revenue"] = round(s["revenue"], 2)

    # Earnings breakdown (commission)
    commission_pct = float(vendor.get("commission_pct", DEFAULT_COMMISSION_PCT))
    commission_deducted = round(total_revenue * commission_pct / 100.0, 2)
    net_earnings = round(total_revenue - commission_deducted, 2)

    # Pending payment = net earnings on delivered but not-yet-paid-out orders (all until payout is implemented)
    pending_payment = net_earnings

    recent = []
    for o in all_orders[:10]:
        my_items = [i for i in o["items"] if i.get("vendor_id") == vid]
        my_subtotal = round(sum(i["price"] * i["quantity"] for i in my_items), 2)
        recent.append({
            "id": str(o["_id"]),
            "created_at": o.get("created_at"),
            "customer_name": o.get("user_name"),
            "my_subtotal": my_subtotal,
            "overall_status": o["status"],
            "items_count": len(my_items),
        })

    low_stock = await db.products.find({"vendor_id": vid, "stock": {"$lt": 5}}).limit(10).to_list(10)

    return {
        "today_orders": today_orders,
        "week_orders": week_orders,
        "month_revenue": round(month_revenue, 2),
        "total_revenue": round(total_revenue, 2),
        "total_items_sold": total_items_sold,
        "commission_pct": commission_pct,
        "commission_deducted": commission_deducted,
        "net_earnings": net_earnings,
        "pending_payment": pending_payment,
        "best_sellers": best_sellers,
        "recent_orders": recent,
        "low_stock": [product_to_out(p) for p in low_stock],
    }


# ---------------------------------------------------------------------------
# Commission, Delivery Partners, Sales Analytics, Vendor Performance
# ---------------------------------------------------------------------------

class CommissionIn(BaseModel):
    commission_pct: float = Field(ge=0, le=90)


class DeliveryPartnerIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str
    vehicle: Optional[str] = ""


class DeliveryPartnerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicle: Optional[str] = None
    active: Optional[bool] = None


class AssignDeliveryIn(BaseModel):
    delivery_partner_id: str
    earning: Optional[float] = None


def dp_to_out(u: dict) -> dict:
    return {
        "id": str(u["_id"]) if "_id" in u else u.get("id"),
        "name": u["name"],
        "email": u["email"],
        "phone": u.get("phone", ""),
        "vehicle": u.get("vehicle", ""),
        "active": u.get("active", True),
        "created_at": u.get("created_at"),
    }


# Commission — admin sets per-vendor
@api.patch("/admin/vendors/{vendor_id}/commission")
async def admin_set_commission(vendor_id: str, payload: CommissionIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(vendor_id)
    res = await db.vendors.update_one({"_id": oid}, {"$set": {"commission_pct": payload.commission_pct}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    v = await db.vendors.find_one({"_id": oid})
    return vendor_to_out(v)


# Delivery partners — admin CRUD
@api.get("/admin/delivery-partners")
async def admin_list_dp(_: dict = Depends(require_admin)):
    docs = await db.users.find({"role": "delivery"}).sort("created_at", -1).to_list(1000)
    return [dp_to_out(d) for d in docs]


@api.post("/admin/delivery-partners")
async def admin_create_dp(payload: DeliveryPartnerIn, _: dict = Depends(require_admin)):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone,
        "vehicle": payload.vehicle or "",
        "password_hash": hash_password(payload.password),
        "role": "delivery",
        "active": True,
        "created_at": iso_now(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return dp_to_out(doc)


@api.patch("/admin/delivery-partners/{dp_id}")
async def admin_update_dp(dp_id: str, payload: DeliveryPartnerUpdate, _: dict = Depends(require_admin)):
    oid = safe_object_id(dp_id)
    update = payload.model_dump(exclude_none=True)
    if update:
        await db.users.update_one({"_id": oid, "role": "delivery"}, {"$set": update})
    u = await db.users.find_one({"_id": oid, "role": "delivery"})
    if not u:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    return dp_to_out(u)


@api.delete("/admin/delivery-partners/{dp_id}")
async def admin_delete_dp(dp_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(dp_id)
    res = await db.users.delete_one({"_id": oid, "role": "delivery"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    return {"success": True}


# Assign delivery partner to an order
@api.patch("/admin/orders/{order_id}/assign")
async def admin_assign_delivery(order_id: str, payload: AssignDeliveryIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(order_id)
    dp_oid = safe_object_id(payload.delivery_partner_id)
    dp = await db.users.find_one({"_id": dp_oid, "role": "delivery"})
    if not dp:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    if not dp.get("active", True):
        raise HTTPException(status_code=400, detail="Delivery partner is inactive")
    earning = float(payload.earning if payload.earning is not None else DEFAULT_DELIVERY_EARNING)
    res = await db.orders.update_one(
        {"_id": oid},
        {"$set": {
            "delivery_partner_id": str(dp_oid),
            "delivery_partner_name": dp["name"],
            "delivery_boy_earning": earning,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    o = await db.orders.find_one({"_id": oid})
    return order_to_out(o)


# Delivery partner: my orders / status / earnings / history
@api.get("/delivery/me")
async def delivery_me(user: dict = Depends(require_delivery)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return dp_to_out(u)

# ---------------------------------------------------------------------------
# NOTIFICATIONS
# ---------------------------------------------------------------------------

@api.get("/notifications")
async def get_notifications(
    user: dict = Depends(get_current_user)
):
    docs = await db.notifications.find({
        "user_id": user["id"]
    }).sort("created_at", -1).limit(50).to_list(50)

    result = []

    for n in docs:
        result.append({
            "id": str(n["_id"]),
            "order_id": n.get("order_id"),
            "title": n.get("title", ""),
            "message": n.get("message", ""),
            "type": n.get("type", "order"),
            "read": n.get("read", False),
            "created_at": n.get("created_at"),
        })

    return result


@api.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: dict = Depends(get_current_user)
):
    oid = safe_object_id(notification_id)

    result = await db.notifications.update_one(
        {
            "_id": oid,
            "user_id": user["id"],
        },
        {
            "$set": {
                "read": True
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {"ok": True}


@api.patch("/notifications/read-all")
async def mark_all_notifications_read(
    user: dict = Depends(get_current_user)
):
    await db.notifications.update_many(
        {
            "user_id": user["id"],
            "read": False,
        },
        {
            "$set": {
                "read": True
            }
        }
    )

    return {"ok": True}

@api.get("/delivery/orders")
async def delivery_my_orders(user: dict = Depends(require_delivery)):
    docs = await db.orders.find({
        "delivery_partner_id": user["id"],
        "status": {"$nin": ["Delivered", "Cancelled"]},
    }).sort("created_at", -1).to_list(500)
    return [order_to_out(o) for o in docs]


@api.get("/delivery/history")
async def delivery_history(user: dict = Depends(require_delivery)):
    docs = await db.orders.find({
        "delivery_partner_id": user["id"],
        "status": {"$in": ["Delivered", "Cancelled"]},
    }).sort("created_at", -1).limit(500).to_list(500)
    return [order_to_out(o) for o in docs]


@api.patch("/delivery/orders/{order_id}/status")
async def delivery_update_status(order_id: str, payload: OrderStatusUpdate, user: dict = Depends(require_delivery)):
    if payload.status not in ("Out For Delivery", "Delivered", "Cancelled"):
        raise HTTPException(status_code=400, detail="Delivery can only mark Out For Delivery / Delivered / Cancelled")
    oid = safe_object_id(order_id)
    o = await db.orders.find_one({"_id": oid, "delivery_partner_id": user["id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Order not assigned to you")
    history = o.get("status_history", [])
    history.append({"status": payload.status, "at": iso_now(), "by": f"delivery:{user['name']}"})
    # Propagate line_status for lines still in transit
    items = o["items"]
    for i in items:
        if i.get("line_status") not in ("Cancelled", "Delivered"):
            i["line_status"] = payload.status
        await db.orders.update_one(
        {"_id": oid},
        {"$set": {"status": payload.status, "status_history": history, "items": items}},
    )

    # ---------------------------------------------------------
    # CUSTOMER NOTIFICATION - ORDER DELIVERED
    # ---------------------------------------------------------

    if payload.status == "Delivered" and o.get("status") != "Delivered":

        await create_order_notification(
            user_id=o["user_id"],
            order_id=str(o["_id"]),
            title="Order Delivered",
            message="Your order has been delivered successfully. Thank you for shopping with us!",
            notification_type="order_delivered",
        )
            # ---------------------------------------------------------
        # CUSTOMER REWARD PROGRESS
        # ---------------------------------------------------------
        # A qualifying order is a Delivered order with subtotal >= ₹249.
        # Count is maintained on the customer document.
        if float(o.get("subtotal", 0) or 0) >= FREE_ORDER_LIMIT: 
            await db.users.update_one(
                {"id": o["user_id"]},
                {
                    "$inc": {
                        "qualifying_order_count": 1
                    }
                },
            )    

    o["status"] = payload.status
    o["status_history"] = history
    o["items"] = items
    return order_to_out(o)



@api.get("/delivery/earnings")
async def delivery_earnings(user: dict = Depends(require_delivery)):
    now = now_utc()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)
    docs = await db.orders.find({"delivery_partner_id": user["id"]}).to_list(5000)

    total_deliveries = 0
    today = 0.0
    week = 0.0
    month = 0.0
    total = 0.0
    pending = 0.0
    for o in docs:
        earn = float(o.get("delivery_boy_earning", 0) or 0)
        if o["status"] == "Delivered":
            total_deliveries += 1
            total += earn
            try:
                created = datetime.fromisoformat(o["created_at"])
            except Exception:
                created = None
            if created and created >= today_start:
                today += earn
            if created and created >= week_start:
                week += earn
            if created and created >= month_start:
                month += earn
        elif o["status"] not in ("Cancelled",):
            pending += earn
    return {
        "total_deliveries": total_deliveries,
        "today_earnings": round(today, 2),
        "week_earnings": round(week, 2),
        "month_earnings": round(month, 2),
        "total_earnings": round(total, 2),
        "pending_earnings": round(pending, 2),
    }


# Admin: sales analytics
@api.get("/admin/analytics")
async def admin_analytics(_: dict = Depends(require_admin), days: int = 14):
    now = now_utc()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    window_start = today_start - timedelta(days=max(1, days) - 1)
    docs = await db.orders.find({}).sort("created_at", -1).to_list(20000)

    total_revenue = 0.0
    total_platform_commission = 0.0
    total_vendor_payout = 0.0
    daily_trend: dict = {}  # 'YYYY-MM-DD' -> {orders, revenue}
    vendor_totals: dict = {}
    product_totals: dict = {}
    total_orders = len(docs)
    pending_orders = 0
    delivered_orders = 0
    cancelled_orders = 0

    # Load vendors for commission lookup
    vendors = {str(v["_id"]): v for v in await db.vendors.find({}).to_list(1000)}

    for o in docs:
        st = o["status"]
        if st == "Pending":
            pending_orders += 1
        elif st == "Delivered":
            delivered_orders += 1
        elif st == "Cancelled":
            cancelled_orders += 1

        try:
            created = datetime.fromisoformat(o["created_at"])
        except Exception:
            continue

        if st == "Delivered":
            total_revenue += o.get("total", 0)
            day = created.strftime("%Y-%m-%d") if created else "unknown"
            if created >= window_start:
                daily_trend.setdefault(day, {"orders": 0, "revenue": 0.0})
                daily_trend[day]["orders"] += 1
                daily_trend[day]["revenue"] += o.get("total", 0)

            for i in o["items"]:
                if i.get("line_status") != "Delivered":
                    continue
                line_total = i["price"] * i["quantity"]
                vid = i.get("vendor_id")
                if vid:
                    vs = vendor_totals.setdefault(vid, {
                        "vendor_id": vid,
                        "vendor_name": i.get("vendor_name", ""),
                        "gross": 0.0,
                        "commission": 0.0,
                        "net_payout": 0.0,
                        "delivered_items": 0,
                    })
                    vs["gross"] += line_total
                    vs["delivered_items"] += i["quantity"]
                    vend = vendors.get(vid)
                    pct = float(vend.get("commission_pct", DEFAULT_COMMISSION_PCT)) if vend else DEFAULT_COMMISSION_PCT
                    com = round(line_total * pct / 100.0, 2)
                    vs["commission"] += com
                    vs["net_payout"] += (line_total - com)
                    total_platform_commission += com
                    total_vendor_payout += (line_total - com)

                pid = i.get("product_id")
                if pid:
                    ps = product_totals.setdefault(pid, {"product_id": pid, "name": i["name"], "image": i["image"], "qty": 0, "revenue": 0.0})
                    ps["qty"] += i["quantity"]
                    ps["revenue"] += line_total

    # Build sorted lists
    top_vendors = sorted(vendor_totals.values(), key=lambda v: v["gross"], reverse=True)[:5]
    top_products = sorted(product_totals.values(), key=lambda p: p["revenue"], reverse=True)[:5]
    for v in top_vendors:
        v["gross"] = round(v["gross"], 2); v["commission"] = round(v["commission"], 2); v["net_payout"] = round(v["net_payout"], 2)
    for p in top_products:
        p["revenue"] = round(p["revenue"], 2)

    # Fill missing days in trend
    trend = []
    for i in range(days):
        d = (today_start - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        t = daily_trend.get(d, {"orders": 0, "revenue": 0.0})
        trend.append({"date": d, "orders": t["orders"], "revenue": round(t["revenue"], 2)})

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "cancelled_orders": cancelled_orders,
        "total_revenue": round(total_revenue, 2),
        "platform_commission_earned": round(total_platform_commission, 2),
        "total_vendor_payout": round(total_vendor_payout, 2),
        "top_vendors": top_vendors,
        "top_products": top_products,
        "daily_trend": trend,
    }


# Admin: vendor performance
@api.get("/admin/vendors/performance")
async def admin_vendor_performance(_: dict = Depends(require_admin)):
    vendors = await db.vendors.find({"status": "Approved"}).to_list(1000)
    result = []
    for v in vendors:
        vid = str(v["_id"])
        # Ratings — from reviews collection (product_slug OR vendor_id)
        vendor_reviews = await db.reviews.find({"vendor_id": vid}).to_list(1000)
        avg_rating = round(sum(r["rating"] for r in vendor_reviews) / len(vendor_reviews), 2) if vendor_reviews else None

        # Orders — count line items owned by this vendor
        orders = await db.orders.find({"items.vendor_id": vid}).to_list(5000)
        total_orders = len(orders)
        delivered = 0
        cancelled = 0
        gross = 0.0
        for o in orders:
            if o["status"] == "Delivered":
                delivered += 1
            elif o["status"] == "Cancelled":
                cancelled += 1
            for i in o["items"]:
                if i.get("vendor_id") == vid and i.get("line_status") == "Delivered":
                    gross += i["price"] * i["quantity"]
        completion_rate = round((delivered / total_orders * 100), 1) if total_orders else 0.0
        result.append({
            "vendor_id": vid,
            "business_name": v["business_name"],
            "commission_pct": v.get("commission_pct", DEFAULT_COMMISSION_PCT),
            "avg_rating": avg_rating,
            "review_count": len(vendor_reviews),
            "total_orders": total_orders,
            "delivered_orders": delivered,
            "cancelled_orders": cancelled,
            "completion_rate": completion_rate,
            "gross_sales": round(gross, 2),
            "vacation_mode": v.get("vacation_mode", False),
            "open_now": v.get("open_now", True),
        })
    result.sort(key=lambda r: r["gross_sales"], reverse=True)
    return result


# WhatsApp notification helper — generates a wa.me deep link that anyone
# (admin, vendor, delivery boy) can click to send a status update. No paid API.
@api.post("/notify/order-whatsapp")
async def notify_order_whatsapp(payload: dict, user: dict = Depends(get_current_user)):
    order_id = payload.get("order_id")
    event = payload.get("event", "update")  # placed|accepted|dispatched|delivered|payment|update
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id required")
    oid = safe_object_id(order_id)
    o = await db.orders.find_one({"_id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    # Access control: admin any; vendor if any of their items; delivery if assigned; customer if own
    role = user.get("role")
    if role == "customer" and o.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if role == "vendor":
        vendor = await db.vendors.find_one({"owner_id": user["id"]})
        vid = str(vendor["_id"]) if vendor else None
        if not vid or not any(i.get("vendor_id") == vid for i in o["items"]):
            raise HTTPException(status_code=403, detail="Order does not contain your items")
    if role == "delivery" and o.get("delivery_partner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Order not assigned to you")

    short_id = str(o["_id"])[-6:].upper()

    # Detailed item breakdown for placed / update events
    def _fmt_items(items):
        lines = []
        for i in items:
            label = i["name"]
            if i.get("variant_label"):
                label += f" ({i['variant_label']})"
            elif i.get("unit"):
                label += f" ({i['unit']})"
            line = f"- {label} x {i['quantity']} @ ₹{i['price']} = ₹{round(i['price']*i['quantity'],2)}"
            if i.get("note"):
                line += f"\n  Note: {i['note']}"
            lines.append(line)
        return "\n".join(lines)

    items_block = _fmt_items(o["items"])
    addr = o["address"]
    full_addr = f"{addr['line1']}"
    if addr.get("landmark"): full_addr += f", {addr['landmark']}"
    full_addr += f", {addr['area']}, {addr.get('city','Ambajogai')} - {addr['pincode']}"

    placed_detail = (
        f"Hi {o['user_name']}, thank you for your order at Ambajogai Grocery Store! 🙏\n\n"
        f"*Order #{short_id}*\n"
        f"{items_block}\n\n"
        f"Subtotal: ₹{o.get('subtotal', o['total'])}\n"
        f"Delivery: {'FREE' if o.get('delivery_fee', 0) == 0 else '₹' + str(o.get('delivery_fee', 0))}"
        + (f"\nDiscount: -₹{o.get('discount', 0)}" if o.get("discount", 0) else "")
        + f"\n*Total: ₹{o['total']}*\n"
        f"Payment: {o['payment_method']}\n\n"
        f"Delivering to: {addr['full_name']} · {addr['phone']}\n{full_addr}\n\n"
        f"Estimated delivery: 30-45 minutes. We'll message you as soon as your order is on its way. 💚"
    )

    feedback_msg = (
        f"Hi {o['user_name']}, hope you enjoyed your Ambajogai Grocery order #{short_id}! 🌿\n\n"
        f"Could you share a quick rating (1-5 ⭐) and let us know what we did well and where we can improve?\n\n"
        f"Just reply to this chat — it takes 30 seconds and helps us serve you better. Thank you!"
    )

    templates = {
        "placed": placed_detail,
        "accepted": f"Hi {o['user_name']}, your Ambajogai Grocery order #{short_id} has been accepted and is being prepared. Total ₹{o['total']}.",
        "dispatched": f"Hi {o['user_name']}, your Ambajogai Grocery order #{short_id} is out for delivery. Please keep the payment of ₹{o['total']} ready if paying COD.",
        "delivered": f"Hi {o['user_name']}, your Ambajogai Grocery order #{short_id} has been delivered. Thanks for shopping with us! 🌿",
        "payment": f"Hi {o['user_name']}, we've received your payment for order #{short_id} (₹{o['total']}). Thanks!",
        "feedback": feedback_msg,
        "update": f"Hi {o['user_name']}, update on your Ambajogai Grocery order #{short_id} — current status: {o['status']}.",
    }
    message = templates.get(event, templates["update"])
    phone = o["address"]["phone"].replace(" ", "").replace("+", "").replace("-", "")
    if phone.startswith("0"):
        phone = "91" + phone[1:]
    if len(phone) == 10:
        phone = "91" + phone
    url = f"https://wa.me/{phone}?text={urllib.parse.quote(message)}"
    return {"url": url, "message": message}


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------

class CouponIn(BaseModel):
    code: str
    discount_pct: float = Field(ge=1, le=90)
    min_amount: float = 0
    active: bool = True
    expires_at: Optional[str] = None  # ISO date string


def coupon_to_out(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "code": c["code"],
        "discount_pct": c["discount_pct"],
        "min_amount": c.get("min_amount", 0),
        "active": c.get("active", True),
        "expires_at": c.get("expires_at"),
        "created_at": c.get("created_at"),
    }


@api.get("/admin/coupons")
async def list_coupons(_: dict = Depends(require_admin)):
    docs = await db.coupons.find().sort("created_at", -1).to_list(500)
    return [coupon_to_out(c) for c in docs]


@api.post("/admin/coupons")
async def create_coupon(payload: CouponIn, _: dict = Depends(require_admin)):
    code = payload.code.strip().upper()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    doc = payload.model_dump()
    doc["code"] = code
    doc["created_at"] = iso_now()
    res = await db.coupons.insert_one(doc)
    doc["_id"] = res.inserted_id
    return coupon_to_out(doc)


@api.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(coupon_id)
    res = await db.coupons.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"success": True}


@api.get("/coupons/{code}/validate")
async def validate_coupon(code: str, subtotal: float = 0):
    code = code.strip().upper()
    coupon = await db.coupons.find_one({"code": code, "active": True})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or inactive coupon")
    if coupon.get("expires_at") and datetime.fromisoformat(coupon["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Coupon expired")
    if subtotal < coupon.get("min_amount", 0):
        raise HTTPException(status_code=400, detail=f"Order must be at least ₹{coupon.get('min_amount', 0)} to use this coupon")
    discount = round(subtotal * (coupon["discount_pct"] / 100.0), 2)
    return {"code": coupon["code"], "discount_pct": coupon["discount_pct"], "discount": discount, "min_amount": coupon.get("min_amount", 0)}


# ---------------------------------------------------------------------------
# Reorder helper
# ---------------------------------------------------------------------------

@api.get("/orders/{order_id}/reorder")
async def reorder_items(order_id: str, user: dict = Depends(get_current_user)):
    oid = safe_object_id(order_id)
    o = await db.orders.find_one({"_id": oid})
    if not o or o.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    items = []
    for i in o["items"]:
        try:
            prod = await db.products.find_one({"_id": ObjectId(i["product_id"])})
        except Exception:
            prod = None
        if not prod:
            continue
        if prod.get("approval_status", "approved") != "approved":
            continue
        items.append({
            "product_id": str(prod["_id"]),
            "name": prod["name"],
            "price": prod["price"],
            "image": prod["image"],
            "unit": prod.get("unit", "1 pc"),
            "quantity": i["quantity"],
            "in_stock": prod.get("stock", 0) >= i["quantity"],
        })
    return {"items": items}


# ---------------------------------------------------------------------------
# Public store info
# ---------------------------------------------------------------------------

@api.get("/store/info")
async def store_info():
    return {
        "name": os.environ.get("STORE_NAME", "Ambajogai Grocery Store"),
        "whatsapp": os.environ.get("STORE_WHATSAPP", "+918237214975"),
        "phone": os.environ.get("STORE_PHONE", os.environ.get("STORE_WHATSAPP", "+918237214975")),
        "upi_id": os.environ.get("STORE_UPI_ID", "ambajogai@upi"),
        "upi_name": os.environ.get("STORE_UPI_NAME", "Ambajogai Grocery Store"),
        "upi_qr": os.environ.get("STORE_UPI_QR", ""),
        "address": "Main Road, Ambajogai, Maharashtra 431517",
        "latitude": float(os.environ.get("STORE_LATITUDE", "18.73")),
        "longitude": float(os.environ.get("STORE_LONGITUDE", "76.38")),
        "email": os.environ.get("STORE_EMAIL", "ambajogaigrocerystores@gmail.com"),
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
    # ============================================================
    # FRUITS & VEGETABLES
    # ============================================================

    {
        "name": "Fresh Tomato",
        "slug": "fresh-tomato",
        "price": 30,
        "mrp": 40,
        "unit": "1 kg",
        "category_slug": "fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80",
        "stock": 50,
        "featured": True,
        "popular": True,
        "description": "Farm-fresh red tomatoes, hand-picked daily.",
        "variants": [
            {"label": "500g", "price": 20, "mrp": 25, "unit": "500g"},
            {"label": "1kg", "price": 30, "mrp": 40, "unit": "1kg"},
            {"label": "2kg", "price": 55, "mrp": 65, "unit": "2kg"},
            {"label": "3kg", "price": 80, "mrp": 95, "unit": "3kg"},
            {"label": "4kg", "price": 105, "mrp": 125, "unit": "4kg"},
            {"label": "5kg", "price": 130, "mrp": 155, "unit": "5kg"},
        ],
    },

    {
        "name": "Onion",
        "slug": "onion",
        "price": 40,
        "mrp": 50,
        "unit": "1 kg",
        "category_slug": "fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1508747703725-719777637510?w=600&q=80",
        "stock": 80,
        "popular": True,
        "description": "Premium quality Nashik onions.",
        "variants": [
            {"label": "500g", "price": 20, "mrp": 25, "unit": "500g"},
            {"label": "1kg", "price": 40, "mrp": 50, "unit": "1kg"},
            {"label": "2kg", "price": 75, "mrp": 90, "unit": "2kg"},
            {"label": "3kg", "price": 110, "mrp": 130, "unit": "3kg"},
            {"label": "5kg", "price": 175, "mrp": 210, "unit": "5kg"},
        ],
    },

    {
        "name": "Banana",
        "slug": "banana",
        "price": 50,
        "mrp": 60,
        "unit": "1 dozen",
        "category_slug": "fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
        "stock": 30,
        "featured": True,
        "description": "Ripe yellow bananas, rich in potassium.",
        "variants": [
            {"label": "6 pcs", "price": 25, "mrp": 30, "unit": "6 pcs"},
            {"label": "12 pcs", "price": 50, "mrp": 60, "unit": "12 pcs"},
            {"label": "24 pcs", "price": 95, "mrp": 115, "unit": "24 pcs"},
        ],
    },

    {
        "name": "Apple - Shimla",
        "slug": "apple-shimla",
        "price": 180,
        "mrp": 220,
        "unit": "1 kg",
        "category_slug": "fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80",
        "stock": 25,
        "featured": True,
        "popular": True,
        "description": "Crisp red apples straight from Himachal orchards.",
        "variants": [
            {"label": "500g", "price": 90, "mrp": 110, "unit": "500g"},
            {"label": "1kg", "price": 180, "mrp": 220, "unit": "1kg"},
            {"label": "2kg", "price": 350, "mrp": 420, "unit": "2kg"},
        ],
    },

    {
        "name": "Potato",
        "slug": "potato",
        "price": 25,
        "mrp": 30,
        "unit": "1 kg",
        "category_slug": "fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
        "stock": 100,
        "description": "Fresh farm potatoes.",
        "variants": [
            {"label": "500g", "price": 13, "mrp": 16, "unit": "500g"},
            {"label": "1kg", "price": 25, "mrp": 30, "unit": "1kg"},
            {"label": "2kg", "price": 48, "mrp": 58, "unit": "2kg"},
            {"label": "5kg", "price": 115, "mrp": 140, "unit": "5kg"},
        ],
    },

    # ============================================================
    # DAIRY & BAKERY
    # ============================================================

    {
        "name": "Amul Milk (Toned)",
        "slug": "amul-milk-toned",
        "price": 32,
        "mrp": 34,
        "unit": "500 ml",
        "category_slug": "dairy-bakery",
        "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&q=80",
        "stock": 60,
        "featured": True,
        "popular": True,
        "description": "Amul toned milk pouch, farm fresh.",
        "variants": [
            {"label": "500ml", "price": 32, "mrp": 34, "unit": "500ml"},
            {"label": "1L", "price": 64, "mrp": 68, "unit": "1L"},
            {"label": "2L", "price": 126, "mrp": 136, "unit": "2L"},
        ],
    },

    {
        "name": "Paneer",
        "slug": "paneer",
        "price": 90,
        "mrp": 100,
        "unit": "200 g",
        "category_slug": "dairy-bakery",
        "image": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80",
        "stock": 20,
        "popular": True,
        "description": "Soft, fresh paneer perfect for curries.",
        "variants": [
            {"label": "200g", "price": 90, "mrp": 100, "unit": "200g"},
            {"label": "500g", "price": 220, "mrp": 250, "unit": "500g"},
            {"label": "1kg", "price": 420, "mrp": 480, "unit": "1kg"},
        ],
    },

    {
        "name": "Amul Butter",
        "slug": "amul-butter",
        "price": 55,
        "mrp": 60,
        "unit": "100 g",
        "category_slug": "dairy-bakery",
        "image": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&q=80",
        "stock": 40,
        "description": "Classic Amul butter for your daily needs.",
        "variants": [
            {"label": "100g", "price": 55, "mrp": 60, "unit": "100g"},
            {"label": "200g", "price": 105, "mrp": 120, "unit": "200g"},
            {"label": "500g", "price": 255, "mrp": 290, "unit": "500g"},
        ],
    },

    {
        "name": "Whole Wheat Bread",
        "slug": "whole-wheat-bread",
        "price": 45,
        "mrp": 50,
        "unit": "400 g",
        "category_slug": "dairy-bakery",
        "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
        "stock": 35,
        "description": "Freshly baked whole wheat bread.",
        "variants": [
            {"label": "400g", "price": 45, "mrp": 50, "unit": "400g"},
            {"label": "800g", "price": 85, "mrp": 100, "unit": "800g"},
        ],
    },

    # ============================================================
    # STAPLES & GRAINS
    # ============================================================

    {
        "name": "Basmati Rice",
        "slug": "basmati-rice",
        "price": 320,
        "mrp": 380,
        "unit": "5 kg",
        "category_slug": "staples-grains",
        "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
        "stock": 15,
        "featured": True,
        "popular": True,
        "description": "Premium long-grain basmati rice.",
        "variants": [
            {"label": "1kg", "price": 70, "mrp": 85, "unit": "1kg"},
            {"label": "5kg", "price": 320, "mrp": 380, "unit": "5kg"},
            {"label": "10kg", "price": 620, "mrp": 740, "unit": "10kg"},
        ],
    },

    {
        "name": "Toor Dal",
        "slug": "toor-dal",
        "price": 165,
        "mrp": 190,
        "unit": "1 kg",
        "category_slug": "staples-grains",
        "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80",
        "stock": 25,
        "popular": True,
        "description": "Fresh, unpolished toor dal.",
        "variants": [
            {"label": "500g", "price": 85, "mrp": 100, "unit": "500g"},
            {"label": "1kg", "price": 165, "mrp": 190, "unit": "1kg"},
            {"label": "2kg", "price": 320, "mrp": 370, "unit": "2kg"},
            {"label": "5kg", "price": 790, "mrp": 900, "unit": "5kg"},
        ],
    },

    {
        "name": "Aashirvaad Atta",
        "slug": "aashirvaad-atta",
        "price": 340,
        "mrp": 400,
        "unit": "5 kg",
        "category_slug": "staples-grains",
        "image": "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=600&q=80",
        "stock": 30,
        "featured": True,
        "description": "100% whole wheat atta for soft rotis.",
        "variants": [
            {"label": "1kg", "price": 75, "mrp": 90, "unit": "1kg"},
            {"label": "5kg", "price": 340, "mrp": 400, "unit": "5kg"},
            {"label": "10kg", "price": 660, "mrp": 780, "unit": "10kg"},
        ],
    },

    {
        "name": "Sunflower Oil",
        "slug": "sunflower-oil",
        "price": 210,
        "mrp": 240,
        "unit": "1 L",
        "category_slug": "staples-grains",
        "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80",
        "stock": 40,
        "description": "Refined sunflower cooking oil.",
        "variants": [
            {"label": "500ml", "price": 110, "mrp": 125, "unit": "500ml"},
            {"label": "1L", "price": 210, "mrp": 240, "unit": "1L"},
            {"label": "2L", "price": 410, "mrp": 460, "unit": "2L"},
            {"label": "5L", "price": 990, "mrp": 1150, "unit": "5L"},
        ],
    },

    # ============================================================
    # SPICES & MASALA
    # ============================================================

    {
        "name": "Turmeric Powder",
        "slug": "turmeric-powder",
        "price": 65,
        "mrp": 80,
        "unit": "200 g",
        "category_slug": "spices-masala",
        "image": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&q=80",
        "stock": 50,
        "description": "Pure haldi powder, ground fresh.",
        "variants": [
            {"label": "100g", "price": 35, "mrp": 42, "unit": "100g"},
            {"label": "200g", "price": 65, "mrp": 80, "unit": "200g"},
            {"label": "500g", "price": 150, "mrp": 180, "unit": "500g"},
            {"label": "1kg", "price": 285, "mrp": 340, "unit": "1kg"},
        ],
    },

    {
        "name": "Red Chilli Powder",
        "slug": "red-chilli-powder",
        "price": 85,
        "mrp": 100,
        "unit": "200 g",
        "category_slug": "spices-masala",
        "image": "https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=600&q=80",
        "stock": 40,
        "popular": True,
        "description": "Spicy red chilli powder.",
        "variants": [
            {"label": "100g", "price": 45, "mrp": 55, "unit": "100g"},
            {"label": "200g", "price": 85, "mrp": 100, "unit": "200g"},
            {"label": "500g", "price": 200, "mrp": 240, "unit": "500g"},
            {"label": "1kg", "price": 380, "mrp": 450, "unit": "1kg"},
        ],
    },

    {
        "name": "Garam Masala",
        "slug": "garam-masala",
        "price": 95,
        "mrp": 110,
        "unit": "100 g",
        "category_slug": "spices-masala",
        "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80",
        "stock": 30,
        "featured": True,
        "description": "Aromatic blend of ground whole spices.",
        "variants": [
            {"label": "50g", "price": 50, "mrp": 60, "unit": "50g"},
            {"label": "100g", "price": 95, "mrp": 110, "unit": "100g"},
            {"label": "200g", "price": 180, "mrp": 215, "unit": "200g"},
            {"label": "500g", "price": 420, "mrp": 500, "unit": "500g"},
        ],
    },

    # ============================================================
    # SNACKS & BEVERAGES
    # ============================================================

    {
        "name": "Parle-G Biscuits",
        "slug": "parle-g",
        "price": 10,
        "mrp": 12,
        "unit": "80 g",
        "category_slug": "snacks-beverages",
        "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80",
        "stock": 200,
        "popular": True,
        "description": "The classic glucose biscuit.",
        "variants": [
            {"label": "50g", "price": 5, "mrp": 6, "unit": "50g"},
            {"label": "80g", "price": 10, "mrp": 12, "unit": "80g"},
            {"label": "200g", "price": 25, "mrp": 30, "unit": "200g"},
            {"label": "800g", "price": 90, "mrp": 105, "unit": "800g"},
        ],
    },

    {
        "name": "Lay's Classic Salted",
        "slug": "lays-classic",
        "price": 20,
        "mrp": 20,
        "unit": "52 g",
        "category_slug": "snacks-beverages",
        "image": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80",
        "stock": 100,
        "description": "Crispy potato chips.",
        "variants": [
            {"label": "26g", "price": 10, "mrp": 10, "unit": "26g"},
            {"label": "52g", "price": 20, "mrp": 20, "unit": "52g"},
            {"label": "95g", "price": 35, "mrp": 40, "unit": "95g"},
        ],
    },

    {
        "name": "Tata Tea Gold",
        "slug": "tata-tea-gold",
        "price": 275,
        "mrp": 310,
        "unit": "500 g",
        "category_slug": "snacks-beverages",
        "image": "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&q=80",
        "stock": 25,
        "featured": True,
        "description": "Rich aroma and taste of premium tea.",
        "variants": [
            {"label": "100g", "price": 60, "mrp": 70, "unit": "100g"},
            {"label": "250g", "price": 145, "mrp": 165, "unit": "250g"},
            {"label": "500g", "price": 275, "mrp": 310, "unit": "500g"},
            {"label": "1kg", "price": 530, "mrp": 600, "unit": "1kg"},
        ],
    },

    # ============================================================
    # PERSONAL CARE
    # ============================================================

    {
        "name": "Dettol Soap",
        "slug": "dettol-soap",
        "price": 40,
        "mrp": 45,
        "unit": "125 g",
        "category_slug": "personal-care",
        "image": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&q=80",
        "stock": 60,
        "description": "Antibacterial protection soap.",
        "variants": [
            {"label": "75g", "price": 28, "mrp": 32, "unit": "75g"},
            {"label": "125g", "price": 40, "mrp": 45, "unit": "125g"},
            {"label": "4 x 125g", "price": 150, "mrp": 180, "unit": "4 x 125g"},
        ],
    },

    {
        "name": "Colgate Toothpaste",
        "slug": "colgate-toothpaste",
        "price": 95,
        "mrp": 110,
        "unit": "150 g",
        "category_slug": "personal-care",
        "image": "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=600&q=80",
        "stock": 45,
        "popular": True,
        "description": "Cavity protection for strong teeth.",
        "variants": [
            {"label": "50g", "price": 35, "mrp": 40, "unit": "50g"},
            {"label": "100g", "price": 65, "mrp": 75, "unit": "100g"},
            {"label": "150g", "price": 95, "mrp": 110, "unit": "150g"},
            {"label": "300g", "price": 180, "mrp": 210, "unit": "300g"},
        ],
    },
]


async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("slug", unique=True)
    await db.categories.create_index("slug", unique=True)
    await db.vendors.create_index("owner_id")
    await db.coupons.create_index("code", unique=True)
    await db.password_reset_otps.create_index("phone", unique=True)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    # Migration: ensure existing products have approval_status set (defaults to approved for legacy store products)
    await db.products.update_many({"approval_status": {"$exists": False}}, {"$set": {"approval_status": "approved"}})

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
        await db.categories.update_one(
            {"slug": c["slug"]},
            {"$setOnInsert": c},
            upsert=True,
        )

    # Products
    for p in SEED_PRODUCTS:
        p_doc = {**p, "created_at": iso_now()}

        p_insert_doc = {**p_doc}
        p_insert_doc.pop("variants", None)

        await db.products.update_one(
            {"slug": p["slug"]},
            {
                "$setOnInsert": p_insert_doc,
                "$set": {
                    "variants": p.get("variants", []),
                },
            },
            upsert=True,
        )

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