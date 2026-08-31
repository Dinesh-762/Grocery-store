from dotenv import load_dotenv
from pathlib import Path

import math
ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import httpx
import ipaddress
import asyncio
import json as _json
from pywebpush import webpush, WebPushException
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
import cloudinary
import cloudinary.uploader
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator, field_validator
from pymongo import ReturnDocument

from pricing_engine import (
    get_platform_settings,
    get_active_pricing_rules,
    get_base_price,
    get_order_item_base_price,
    vendor_order_item_out,
    compute_product_price,
    enrich_product_for_customer,
    compute_delivery_fee_from_settings,
    compute_order_totals,
    product_to_vendor_out,
    default_platform_settings,
)
from platform_services import (
    iso_now as platform_iso_now,
    generate_referral_code,
    log_audit,
    create_notification,
    get_wallet_summary,
    release_pending_earnings,
    credit_vendor_order_earning,
)
from vendor_routes import register_platform_routes


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


DEFAULT_COMMISSION_PCT = float(os.environ.get("DEFAULT_COMMISSION_PCT", "0"))
DEFAULT_DELIVERY_EARNING = float(os.environ.get("DEFAULT_DELIVERY_EARNING", "20"))

# ---------------------------------------------------------------------------
# Emergent-managed Email (Resend) — used for forgot-password OTP
# ---------------------------------------------------------------------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Ambajogai Grocery Store")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


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
    profile_photo: Optional[str] = None
    role: str = "customer"
    created_at: str


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    phone: Optional[str] = None


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
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)


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
    distance_km: Optional[float] = None

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        if v not in ("UPI", "COD"):
            raise ValueError("Payment method must be UPI or COD")
        return v


ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered", "Cancelled"]
VENDOR_LINE_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready"]


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
        "profile_photo": u.get("profile_photo"),
        "role": u.get("role", "customer"),
        "created_at": u.get("created_at", iso_now()),
    }


async def _read_upload_image(file: UploadFile) -> tuple[bytes, str]:
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    ext_to_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in allowed_types:
        ext = Path(file.filename or "").suffix.lower()
        content_type = ext_to_type.get(ext)
    if not content_type or content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: JPG, PNG, WEBP, GIF.",
        )
    max_bytes = 5 * 1024 * 1024
    try:
        contents = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large. Max size is 5 MB")
    return contents, content_type


def _cloudinary_configured() -> bool:
    if os.environ.get("UPLOAD_STORAGE", "").strip().lower() == "local":
        return False
    if os.environ.get("CLOUDINARY_ENABLED", "").strip().lower() not in ("1", "true", "yes"):
        return False
    keys = ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    return all((os.environ.get(k) or "").strip() for k in keys)


def _ext_for_content_type(content_type: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type, ".jpg")


async def _store_uploaded_image(contents: bytes, content_type: str, *, folder: str = "grocery_products") -> str:
    """Upload to Cloudinary when fully configured, otherwise save locally under /api/uploads/."""
    if _cloudinary_configured():
        try:
            result = cloudinary.uploader.upload(contents, folder=folder)
            url = result.get("secure_url") if isinstance(result, dict) else None
            if url:
                return url
        except Exception as e:
            logger.warning("Cloudinary upload failed, falling back to local storage: %s", e)

    ext = _ext_for_content_type(content_type)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(contents)
    if not dest.exists():
        raise RuntimeError("Could not save uploaded image locally")
    return f"/api/uploads/{filename}"


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
        "platform_fee": o.get("platform_fee", 0),
        "gst": o.get("gst", 0),
        "cgst": o.get("cgst", 0),
        "sgst": o.get("sgst", 0),
        "distance_km": o.get("distance_km"),
        "discount": o.get("discount", 0),
        "coupon": o.get("coupon"),
        "total": o["total"],
        "status": o["status"],
        "status_history": o.get("status_history", []),
        "created_at": o.get("created_at", iso_now()),
        "delivery_partner_id": o.get("delivery_partner_id"),
        "delivery_partner_name": o.get("delivery_partner_name"),
        "delivery_boy_earning": o.get("delivery_boy_earning", 0),
        "assigned_at": o.get("assigned_at"),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@api.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "vendor"):
        raise HTTPException(status_code=403, detail="Only admins and vendors can upload images")

    contents, content_type = await _read_upload_image(file)
    try:
        url = await _store_uploaded_image(contents, content_type, folder="grocery_products")
        return {"url": url}
    except Exception as e:
        logger.exception("Image upload failed")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")



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
        if vstatus == "Rejected":
            raise HTTPException(status_code=403, detail="Your vendor application was rejected. Please contact support.")
        if vstatus == "Suspended":
            raise HTTPException(status_code=403, detail="Your vendor account is suspended. Please contact support.")
        if vstatus == "Blocked":
            raise HTTPException(status_code=403, detail="Your vendor account is blocked. Please contact support.")
    token = create_token(str(user["_id"]), email, user.get("role", "customer"))
    return {"token": token, "user": user_to_out(user)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


@api.patch("/users/me", response_model=UserOut)
async def update_profile(payload: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        updates["phone"] = payload.phone.strip() or None
    if not updates:
        return user_to_out(user)
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": updates})
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    return user_to_out(doc)


@api.post("/users/me/photo", response_model=UserOut)
async def upload_profile_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    contents, content_type = await _read_upload_image(file)
    try:
        photo_url = await _store_uploaded_image(contents, content_type, folder="grocery_avatars")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile photo upload failed: {str(e)}")

    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"profile_photo": photo_url}},
    )
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    return user_to_out(doc)


@api.delete("/users/me/photo", response_model=UserOut)
async def delete_profile_photo(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$unset": {"profile_photo": ""}},
    )
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    return user_to_out(doc)


# ---------------------------------------------------------------------------
# Forgot password — email OTP via Emergent-managed Resend
# ---------------------------------------------------------------------------

class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6, max_length=128)


def _password_reset_email_html(name: str, code: str) -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#FDFBF7;padding:24px;font-family:Arial,sans-serif">'
        f'<tr><td>'
        f'<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;'
        f'background:#ffffff;border-radius:16px;padding:32px">'
        f'<tr><td>'
        f'<h1 style="margin:0 0 8px;color:#1B4332;font-size:20px">Reset your password</h1>'
        f'<p style="margin:0 0 16px;color:#4A4A4A;font-size:14px">Hi {escape(name or "there")}, use the code below to reset your Ambajogai Grocery Store password. It expires in 10 minutes.</p>'
        f'<div style="text-align:center;margin:24px 0">'
        f'<div style="display:inline-block;background:#1B4332;color:#ffffff;font-size:28px;'
        f'letter-spacing:8px;padding:16px 24px;border-radius:12px;font-weight:bold">{escape(code)}</div>'
        f'</div>'
        f'<p style="margin:0 0 8px;color:#4A4A4A;font-size:13px">If you did not request this, you can safely ignore this email — your password will not change.</p>'
        f'<p style="margin:24px 0 0;color:#8BA888;font-size:12px">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        f'</td></tr></table>'
        f'</td></tr></table>'
    )


FORGOT_PASSWORD_COOLDOWN_SEC = 60


# ---------------------------------------------------------------------------
# Web Push (VAPID) — admin new-order notifications when the tab is closed
# ---------------------------------------------------------------------------

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = (os.environ.get("VAPID_PRIVATE_KEY", "") or "").replace("\\n", "\n")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@ambajogai.com")


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict  # { p256dh, auth }


@api.get("/push/vapid-public-key")
async def get_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}


@api.post("/push/subscribe")
async def push_subscribe(payload: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "delivery"):
        raise HTTPException(status_code=403, detail="Only admins and delivery boys can subscribe")
    await db.push_subscriptions.update_one(
        {"endpoint": payload.endpoint},
        {"$set": {
            "user_id": user["id"],
            "role": user.get("role"),
            "endpoint": payload.endpoint,
            "keys": payload.keys,
            "updated_at": iso_now(),
        }},
        upsert=True,
    )
    return {"success": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(payload: dict, user: dict = Depends(get_current_user)):
    endpoint = payload.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["id"]})
    return {"success": True}


def _send_push_sync(sub: dict, message: dict) -> bool:
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=_json.dumps(message),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=60,
        )
        return True
    except WebPushException as e:
        # 404/410 means the subscription is dead — clean it up
        if e.response is not None and e.response.status_code in (404, 410):
            return False
        return False
    except Exception:
        return False


async def broadcast_push_to_admins(title: str, body: str, url: str = "/admin/orders"):
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return
    subs = await db.push_subscriptions.find({"role": "admin"}).to_list(500)
    if not subs:
        return
    message = {"title": title, "body": body, "url": url}
    dead = []
    for s in subs:
        ok = await asyncio.to_thread(_send_push_sync, s, message)
        if not ok:
            dead.append(s["endpoint"])
    if dead:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": dead}})


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always return success to prevent user enumeration
    if not user:
        return {"success": True, "message": "If an account exists, a code was sent."}

    # 60-second cooldown between OTP requests per email
    existing = await db.password_resets.find_one({"email": email})
    if existing and existing.get("last_sent_at"):
        try:
            last_sent = datetime.fromisoformat(existing["last_sent_at"])
            elapsed = (now_utc() - last_sent).total_seconds()
            if elapsed < FORGOT_PASSWORD_COOLDOWN_SEC:
                wait = int(FORGOT_PASSWORD_COOLDOWN_SEC - elapsed)
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {wait} seconds before requesting another code.",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # bad timestamp — proceed

    code = str(uuid.uuid4().int)[-6:]
    # Preserve attempts on re-request so a spammer cannot reset the 5-attempt lockout
    prior_attempts = int(existing.get("attempts", 0)) if existing else 0
    await db.password_resets.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "code": code,
            "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
            "attempts": prior_attempts,
            "last_sent_at": iso_now(),
        }},
        upsert=True,
    )
    subject = f"Your {EMAIL_FROM_NAME} password reset code"
    html = _password_reset_email_html(user.get("name", ""), code)
    try:
        await send_email(to=email, subject=subject, html=html)
    except HTTPException:
        logger.error(f"Failed to send password reset email to {email}")
    return {"success": True, "message": "If an account exists, a code was sent."}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    email = payload.email.lower().strip()
    rec = await db.password_resets.find_one({"email": email})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new code.")
    if rec.get("code") != payload.code.strip():
        await db.password_resets.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await db.password_resets.delete_one({"email": email})
    return {"success": True, "message": "Password reset successful. Please sign in."}


# ---------------------------------------------------------------------------
# Saved delivery addresses (per-user)
# ---------------------------------------------------------------------------

class SavedAddressIn(BaseModel):
    label: str = Field(min_length=1, max_length=30)  # Home / Work / Other
    full_name: str
    phone: str
    line1: str
    landmark: Optional[str] = ""
    area: str
    city: str = "Ambajogai"
    pincode: str
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


def _address_to_out(a: dict) -> dict:
    out = {
        "id": a.get("id"),
        "label": a.get("label", "Home"),
        "full_name": a.get("full_name", ""),
        "phone": a.get("phone", ""),
        "line1": a.get("line1", ""),
        "landmark": a.get("landmark", ""),
        "area": a.get("area", ""),
        "city": a.get("city", "Ambajogai"),
        "pincode": a.get("pincode", ""),
    }
    if a.get("latitude") is not None:
        out["latitude"] = a["latitude"]
    if a.get("longitude") is not None:
        out["longitude"] = a["longitude"]
    return out


@api.get("/users/me/addresses")
async def list_addresses(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return [_address_to_out(a) for a in (u.get("saved_addresses") or [])]


@api.post("/users/me/addresses")
async def add_address(payload: SavedAddressIn, user: dict = Depends(get_current_user)):
    new_addr = {**payload.model_dump(), "id": str(uuid.uuid4())}
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$push": {"saved_addresses": new_addr}},
    )
    return _address_to_out(new_addr)


@api.delete("/users/me/addresses/{addr_id}")
async def delete_address(addr_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$pull": {"saved_addresses": {"id": addr_id}}},
    )
    return {"success": True}


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


@api.put("/categories/{cat_id}", response_model=CategoryOut)
async def update_category(cat_id: str, payload: CategoryIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(cat_id)
    existing = await db.categories.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    slug_clash = await db.categories.find_one({"slug": payload.slug, "_id": {"$ne": oid}})
    if slug_clash:
        raise HTTPException(status_code=400, detail="Slug already used")
    await db.categories.update_one({"_id": oid}, {"$set": payload.model_dump()})
    doc = await db.categories.find_one({"_id": oid})
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
    settings = await get_platform_settings(db)
    rules = await get_active_pricing_rules(db)
    result = []
    for d in docs:
        enriched = await enrich_product_for_customer(db, d, settings=settings, rules=rules)
        result.append(product_to_out(enriched))
    return result


@api.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    doc = await db.products.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    if doc.get("approval_status", "approved") != "approved":
        raise HTTPException(status_code=404, detail="Product not found")
    enriched = await enrich_product_for_customer(db, doc)
    return product_to_out(enriched)


@api.post("/products", response_model=ProductOut)
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    exists = await db.products.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = payload.model_dump()
    doc["base_price"] = doc["price"]
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
# Delivery GPS / serviceability
# ---------------------------------------------------------------------------

DELIVERY_MAX_SERVICE_DISTANCE_KM = float(
    os.environ.get("DELIVERY_MAX_SERVICE_DISTANCE_KM", "15")
)

def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )

    return round(
        earth_radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)),
        3,
    )


@api.get("/delivery/serviceability")
async def delivery_serviceability(
    latitude: float,
    longitude: float,
    accuracy: Optional[float] = None,
):
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid GPS coordinates")

    if accuracy is not None and (
        not math.isfinite(accuracy) or accuracy < 0
    ):
        raise HTTPException(status_code=400, detail="Invalid GPS accuracy")

    distance_km = calculate_distance_km(
        DELIVERY_CENTER_LAT,
        DELIVERY_CENTER_LNG,
        latitude,
        longitude,
    )

    serviceable = distance_km <= DELIVERY_MAX_SERVICE_DISTANCE_KM

    return {
        "serviceable": serviceable,
        "message": (
            "Delivery is available at this address."
            if serviceable
            else "Sorry, this delivery address is outside our Ambajogai delivery area."
        ),
        "distance_km": distance_km,
        "accuracy_m": round(accuracy, 1) if accuracy is not None else None,
        "max_distance_km": DELIVERY_MAX_SERVICE_DISTANCE_KM,
        "zone_name": "Ambajogai",
    }


NOMINATIM_HEADERS = {"User-Agent": "AmbajogaiGrocery/1.0 (delivery geocoding)"}


@api.get("/delivery/geocode")
async def delivery_geocode(
    line1: str = "",
    area: str = "",
    pincode: str = "",
    city: str = "Ambajogai",
):
    """Forward-geocode a delivery address to lat/lng via Nominatim."""
    parts = [
        p.strip()
        for p in [line1, area, pincode, city, "Maharashtra", "India"]
        if p and p.strip()
    ]
    if len(parts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Provide address line, area, and pincode to locate the delivery address.",
        )

    query = ", ".join(parts)
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode(
            {
                "format": "jsonv2",
                "q": query,
                "limit": 1,
                "countrycodes": "in",
            }
        )
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=NOMINATIM_HEADERS)
            resp.raise_for_status()
            results = resp.json()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to look up this address right now. Please try again.",
        )

    if not results:
        raise HTTPException(
            status_code=404,
            detail="Could not find this address. Please check the address details.",
        )

    hit = results[0]
    try:
        latitude = float(hit["lat"])
        longitude = float(hit["lon"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Invalid geocoding response.")

    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(status_code=502, detail="Invalid geocoding coordinates.")

    return {
        "latitude": latitude,
        "longitude": longitude,
        "display_name": hit.get("display_name", query),
    }


@api.get("/delivery/reverse-geocode")
async def delivery_reverse_geocode(
    latitude: float,
    longitude: float,
):
    """Reverse-geocode coordinates into address fields for auto-fill."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")

    url = (
        "https://nominatim.openstreetmap.org/reverse?"
        + urllib.parse.urlencode(
            {
                "format": "jsonv2",
                "lat": latitude,
                "lon": longitude,
                "zoom": 18,
                "addressdetails": 1,
            }
        )
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=NOMINATIM_HEADERS)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to look up this location right now. Please try again.",
        )

    addr = data.get("address") or {}
    line1 = " ".join(
        p for p in [addr.get("house_number"), addr.get("road")] if p
    ).strip()
    area = (
        addr.get("suburb")
        or addr.get("neighbourhood")
        or addr.get("locality")
        or addr.get("village")
        or addr.get("town")
        or addr.get("city_district")
        or addr.get("hamlet")
        or ""
    )

    return {
        "line1": line1,
        "area": area,
        "pincode": addr.get("postcode") or "",
        "display_name": data.get("display_name") or "",
        "latitude": latitude,
        "longitude": longitude,
    }


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

DELIVERY_CENTER_LAT = float(os.environ.get("DELIVERY_CENTER_LAT", "18.735994"))
DELIVERY_CENTER_LNG = float(os.environ.get("DELIVERY_CENTER_LNG", "76.3891403"))
DELIVERY_NEAR_KM = 1.5
DELIVERY_NEAR_FEE = 15.0
DELIVERY_FIRST_KM_FEE = 15.0
DELIVERY_PER_KM = 12.0
MIN_ORDER_AMOUNT = 100.0
PLATFORM_FEE = 10.0
GST_RATE = 0.05
CGST_RATE = 0.025
SGST_RATE = 0.025
FREE_DELIVERY_THRESHOLD = 499.0


def compute_delivery_fee(distance_km: float, subtotal: float) -> float:
    if subtotal >= FREE_DELIVERY_THRESHOLD:
        return 0.0

    d = max(0.0, float(distance_km or 0))

    if d <= DELIVERY_NEAR_KM:
        return DELIVERY_NEAR_FEE

    return round(
        DELIVERY_NEAR_FEE + ((d - DELIVERY_NEAR_KM) * DELIVERY_PER_KM),
        2,
    )


async def restore_order_stock(order: dict) -> None:
    """Return reserved inventory when an order is cancelled (idempotent)."""
    if order.get("stock_restored"):
        return
    for it in order.get("items", []):
        pid = it.get("product_id")
        qty = int(it.get("quantity") or 0)
        if not pid or qty <= 0:
            continue
        try:
            await db.products.update_one(
                {"_id": ObjectId(pid)},
                {"$inc": {"stock": qty}},
            )
        except Exception:
            logger.exception("Failed to restore stock for product %s", pid)
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"stock_restored": True}},
    )


def safe_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id format")


@api.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    settings = await get_platform_settings(db)
    rules = await get_active_pricing_rules(db)

    # Recompute prices server-side from DB and validate stock
    verified_items = []
    vendor_min_totals: dict = {}  # vendor_id -> subtotal (customer selling prices)
    for it in payload.items:
        try:
            prod = await db.products.find_one({"_id": ObjectId(it.product_id)})
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid product id: {it.product_id}")
        if not prod:
            raise HTTPException(status_code=400, detail=f"Product not found: {it.name}")
        if prod.get("approval_status", "approved") != "approved":
            raise HTTPException(status_code=400, detail=f"Product '{prod['name']}' is not available for purchase")
        if prod.get("product_status") == "draft":
            raise HTTPException(status_code=400, detail=f"Product '{prod['name']}' is not available")
        if it.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        if prod.get("stock", 0) < it.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {prod['name']}")
        pricing = await compute_product_price(db, prod, variant_label=it.variant_label, settings=settings, rules=rules)
        eff_price = pricing["selling_price"]
        eff_unit = prod.get("unit", "1 pc")
        if it.variant_label:
            variants = prod.get("variants") or []
            match = next((v for v in variants if v.get("label") == it.variant_label), None)
            if not match:
                raise HTTPException(status_code=400, detail=f"Unknown variant '{it.variant_label}' for {prod['name']}")
            eff_unit = match.get("unit", eff_unit)
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
            "base_price": pricing["base_price"],
            "quantity": it.quantity,
            "image": prod["image"],
            "unit": eff_unit,
            "vendor_id": prod.get("vendor_id"),
            "vendor_name": prod.get("vendor_name"),
            "line_status": "Pending",
            "variant_label": it.variant_label,
            "note": (it.note or "").strip() or None,
            "pricing_snapshot": {
                "base_price": pricing["base_price"],
                "markup_pct": pricing["markup_pct"],
                "markup_amount": pricing["markup_amount"],
                "selling_price": pricing["selling_price"],
                "gst_rate": pricing.get("gst_rate", settings.get("gst_rate")),
                "rule_source": pricing.get("rule_source"),
            },
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

    min_order = float(settings.get("min_order_amount", MIN_ORDER_AMOUNT))
    if subtotal < min_order:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order amount is ₹{int(min_order)}. Current subtotal is ₹{subtotal:.2f}."
        )

    # Delivery address coordinates are required for zone validation and fee calculation
    addr_lat = payload.address.latitude
    addr_lng = payload.address.longitude
    if addr_lat is None or addr_lng is None:
        raise HTTPException(
            status_code=400,
            detail="Delivery address location is required. Please verify your address on checkout.",
        )

    if not (
        -90 <= addr_lat <= 90
        and -180 <= addr_lng <= 180
        and math.isfinite(addr_lat)
        and math.isfinite(addr_lng)
    ):
        raise HTTPException(status_code=400, detail="Invalid delivery address coordinates.")

    dist = round(
        calculate_distance_km(
            DELIVERY_CENTER_LAT,
            DELIVERY_CENTER_LNG,
            addr_lat,
            addr_lng,
        ),
        2,
    )

    if dist > DELIVERY_MAX_SERVICE_DISTANCE_KM:
        raise HTTPException(
            status_code=400,
            detail=(
                "Sorry, this delivery address is outside our Ambajogai delivery area "
                f"(max {DELIVERY_MAX_SERVICE_DISTANCE_KM:g} km from store)."
            ),
        )

    delivery_fee = compute_delivery_fee_from_settings(settings, dist, subtotal)

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

    totals = compute_order_totals(settings, subtotal, dist, discount)
    platform_fee = totals["platform_fee"]
    taxable_amount = totals["taxable_amount"]
    cgst = totals["cgst"]
    sgst = totals["sgst"]
    gst = totals["gst"]
    total = totals["total"]
    status_history = [{"status": "Pending", "at": iso_now()}]

    # Atomically reserve stock before creating the order
    reserved: list[dict] = []
    try:
        for it in verified_items:
            result = await db.products.find_one_and_update(
                {
                    "_id": ObjectId(it["product_id"]),
                    "stock": {"$gte": it["quantity"]},
                    "$or": [
                        {"approval_status": "approved"},
                        {"approval_status": {"$exists": False}},
                    ],
                },
                {"$inc": {"stock": -it["quantity"]}},
                return_document=ReturnDocument.AFTER,
            )
            if not result:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {it['name']}. Please refresh and try again.",
                )
            reserved.append(it)
    except HTTPException:
        for it in reserved:
            await db.products.update_one(
                {"_id": ObjectId(it["product_id"])},
                {"$inc": {"stock": it["quantity"]}},
            )
        raise
    except Exception:
        for it in reserved:
            await db.products.update_one(
                {"_id": ObjectId(it["product_id"])},
                {"$inc": {"stock": it["quantity"]}},
            )
        raise HTTPException(status_code=500, detail="Could not reserve inventory. Please try again.")

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
        "platform_fee": platform_fee,
        "gst": gst,
        "cgst": cgst,
        "sgst": sgst,
        "distance_km": dist,
        "discount": discount,
        "coupon": coupon_applied,
        "total": total,
        "pricing_snapshot": {
            "subtotal": subtotal,
            "discount": discount,
            "delivery_fee": delivery_fee,
            "platform_fee": platform_fee,
            "gst": gst,
            "cgst": cgst,
            "sgst": sgst,
            "total": total,
            "global_markup_pct": settings.get("global_markup_pct"),
            "settings_version": settings.get("_id", "default"),
        },
        "status": "Pending",
        "status_history": status_history,
        "stock_restored": False,
        "created_at": iso_now(),
    }
    try:
        res = await db.orders.insert_one(doc)
    except Exception:
        for it in reserved:
            await db.products.update_one(
                {"_id": ObjectId(it["product_id"])},
                {"$inc": {"stock": it["quantity"]}},
            )
        raise HTTPException(status_code=500, detail="Order could not be created. Please try again.")
    doc["_id"] = res.inserted_id

    # Fire-and-forget push to admins so they get notified when browser is closed
    try:
        short_id = str(doc["_id"])[-6:].upper()
        asyncio.create_task(broadcast_push_to_admins(
            title=f"New order #{short_id}",
            body=f"₹{doc['total']} from {doc['user_name']} · {doc['payment_method']}",
            url="/admin/orders",
        ))
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


@api.get("/admin/orders/pending-count")
async def admin_pending_orders_count(_: dict = Depends(require_admin)):
    count = await db.orders.count_documents({"status": "Pending"})
    latest = await db.orders.find({"status": "Pending"}).sort("created_at", -1).limit(1).to_list(1)
    return {
        "count": count,
        "latest_id": str(latest[0]["_id"]) if latest else None,
        "latest_created_at": latest[0].get("created_at") if latest else None,
    }


@api.get("/delivery/new-count")
async def delivery_new_count(user: dict = Depends(require_delivery)):
    active_filter = {
        "delivery_partner_id": user["id"],
        "status": {"$nin": ["Delivered", "Cancelled"]},
    }
    count = await db.orders.count_documents(active_filter)
    latest = await db.orders.find(active_filter).sort(
        [("assigned_at", -1), ("created_at", -1)]
    ).limit(1).to_list(1)
    latest_doc = latest[0] if latest else None
    return {
        "count": count,
        "latest_id": str(latest_doc["_id"]) if latest_doc else None,
        "latest_assigned_at": latest_doc.get("assigned_at") if latest_doc else None,
        "latest_created_at": latest_doc.get("created_at") if latest_doc else None,
    }


@api.patch("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate, _: dict = Depends(require_admin)):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    oid = safe_object_id(order_id)
    doc = await db.orders.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")

    # Strict order flow: allow only forward progression by one step, or Cancel (any time before Delivered)
    flow = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered"]
    current = doc.get("status", "Pending")
    new_status = payload.status
    if new_status == current:
        raise HTTPException(status_code=400, detail=f"Order is already {current}")
    if new_status == "Cancelled":
        if current == "Delivered":
            raise HTTPException(status_code=400, detail="Delivered orders cannot be cancelled")
    else:
        if current == "Cancelled":
            raise HTTPException(status_code=400, detail="Cancelled orders cannot be updated")
        if current == "Delivered":
            raise HTTPException(status_code=400, detail="Order is already delivered")
        try:
            ci = flow.index(current)
            ni = flow.index(new_status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status transition")
        if ni < ci:
            raise HTTPException(status_code=400, detail=f"Order cannot move backward from {current} to {new_status}")
        if ni != ci + 1:
            raise HTTPException(status_code=400, detail=f"Must move to next step: {flow[ci + 1] if ci + 1 < len(flow) else 'Delivered'}")

    if new_status == "Cancelled" and current != "Cancelled":
        await restore_order_stock(doc)

    history = doc.get("status_history", [])
    history.append({"status": payload.status, "at": iso_now()})
    set_doc = {"status": payload.status, "status_history": history}
    if new_status == "Delivered":
        updated_items = [{**i, "line_status": "Delivered"} for i in doc.get("items", [])]
        set_doc["items"] = updated_items
        doc["items"] = updated_items
    await db.orders.update_one({"_id": oid}, {"$set": set_doc})
    doc["status"] = payload.status
    doc["status_history"] = history
    doc["_id"] = oid
    if new_status == "Delivered":
        await _maybe_credit_vendor_earnings(doc, "Delivered")
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
async def create_review(payload: ReviewIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("customer", "admin"):
        raise HTTPException(status_code=403, detail="Only customers can submit reviews")
    comment = (payload.comment or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Review comment is required")
    if len(comment) > 2000:
        raise HTTPException(status_code=400, detail="Review comment is too long")
    doc = {
        "product_slug": payload.product_slug,
        "rating": payload.rating,
        "comment": comment,
        "author_name": user.get("name", "Customer"),
        "user_id": user["id"],
        "created_at": iso_now(),
    }
    res = await db.reviews.insert_one(doc)
    return {
        "id": str(res.inserted_id),
        "product_slug": doc["product_slug"],
        "rating": doc["rating"],
        "comment": doc["comment"],
        "author_name": doc["author_name"],
        "user_id": doc["user_id"],
        "created_at": doc["created_at"],
    }


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

VENDOR_STATUSES = ["Pending", "Under Review", "Approved", "Rejected", "Suspended", "Blocked"]


class BankDetailsIn(BaseModel):
    account_holder_name: Optional[str] = ""
    bank_name: Optional[str] = ""
    account_number: Optional[str] = ""
    ifsc_code: Optional[str] = ""


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
    business_category: Optional[str] = ""
    gst_number: Optional[str] = ""
    pan_number: Optional[str] = ""
    referral_code: Optional[str] = None
    bank_details: Optional[BankDetailsIn] = None
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
        "business_category": v.get("business_category", ""),
        "gst_number": v.get("gst_number", ""),
        "pan_number": v.get("pan_number", ""),
        "bank_details": v.get("bank_details", {}),
        "referral_code": v.get("referral_code", ""),
        "referred_by_code": v.get("referred_by_code", ""),
    }


async def get_vendor_profile(user: dict) -> Optional[dict]:
    if user.get("role") != "vendor":
        return None
    return await db.vendors.find_one({"owner_id": user["id"]})


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
    ref_code = generate_referral_code()
    referred_by = (payload.referral_code or "").strip().upper() or None
    vendor_doc = {
        "owner_id": str(ures.inserted_id),
        "owner_email": email,
        "owner_name": payload.name.strip(),
        "phone": payload.phone,
        "business_name": payload.business_name.strip(),
        "business_description": payload.business_description.strip(),
        "business_address": payload.business_address.strip(),
        "business_pincode": payload.business_pincode.strip(),
        "business_category": (payload.business_category or "").strip(),
        "gst_number": (payload.gst_number or "").strip(),
        "pan_number": (payload.pan_number or "").strip(),
        "docs": payload.docs.model_dump(),
        "bank_details": payload.bank_details.model_dump() if payload.bank_details else {},
        "referral_code": ref_code,
        "referred_by_code": referred_by,
        "status": "Pending",
        "created_at": iso_now(),
    }
    vres = await db.vendors.insert_one(vendor_doc)
    vendor_doc["_id"] = vres.inserted_id
    if referred_by:
        await db.referrals.insert_one({
            "referrer_code": referred_by,
            "referred_vendor_id": str(vres.inserted_id),
            "status": "registered",
            "created_at": iso_now(),
        })
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
    enriched_products = []
    settings = await get_platform_settings(db)
    rules = await get_active_pricing_rules(db)
    for p in products:
        enriched = await enrich_product_for_customer(db, p, settings=settings, rules=rules)
        enriched_products.append(product_to_out(enriched))
    # Aggregate reviews from this vendor's products for a storefront rating
    product_slugs = [p["slug"] for p in products]
    review_query = {"$or": [{"vendor_id": str(oid)}]}
    if product_slugs:
        review_query["$or"].append({"product_slug": {"$in": product_slugs}})
    reviews = await db.reviews.find(review_query).to_list(2000)
    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else None
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
        "avg_rating": avg_rating,
        "review_count": len(reviews),
        "products": enriched_products,
    }


# Admin: all vendors
@api.get("/admin/vendors")
async def admin_list_vendors(_: dict = Depends(require_admin), status_filter: Optional[str] = None):
    q = {"status": status_filter} if status_filter else {}
    docs = await db.vendors.find(q).sort("created_at", -1).to_list(1000)
    return [vendor_to_out(v) for v in docs]


@api.patch("/admin/vendors/{vendor_id}/status")
async def admin_update_vendor_status(vendor_id: str, payload: VendorStatusUpdate, admin: dict = Depends(require_admin)):
    if payload.status not in VENDOR_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid vendor status")
    oid = safe_object_id(vendor_id)
    old_vendor = await db.vendors.find_one({"_id": oid})
    if not old_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    update_doc = {"status": payload.status}
    if payload.status == "Approved":
        update_doc["approved_at"] = iso_now()
        update_doc["rejection_reason"] = ""
    elif payload.status == "Rejected":
        update_doc["rejection_reason"] = payload.reason or ""
    await db.vendors.update_one({"_id": oid}, {"$set": update_doc})
    vendor = await db.vendors.find_one({"_id": oid})
    if payload.status in ("Rejected", "Suspended", "Blocked"):
        await db.products.update_many({"vendor_id": str(oid)}, {"$set": {"approval_status": "pending"}})
    if payload.status == "Approved" and old_vendor.get("status") != "Approved":
        settings = await get_platform_settings(db)
        from platform_services import process_referral_on_approval
        await process_referral_on_approval(db, vendor, settings)
        if vendor.get("owner_id"):
            await create_notification(
                db, user_id=vendor["owner_id"], role="vendor",
                title="Vendor account approved!",
                body="Your vendor account has been approved. You now have full access to the Vendor Dashboard.",
                ntype="account", link="/vendor",
            )
    await log_audit(db, actor_id=admin["id"], actor_role="admin", action="vendor_status_change",
                    entity_type="vendor", entity_id=vendor_id,
                    previous_value=old_vendor.get("status"), new_value=payload.status)
    return vendor_to_out(vendor)


# Vendor: my products
@api.get("/vendor/products")
async def vendor_my_products(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    docs = await db.products.find({"vendor_id": str(vendor["_id"])}).sort("created_at", -1).to_list(1000)
    return [product_to_vendor_out(p) for p in docs]


def _product_payload_to_doc(payload: ProductIn, as_vendor: bool = False) -> dict:
    doc = payload.model_dump()
    base = float(doc.pop("price", 0))
    doc["base_price"] = base
    doc["price"] = base  # legacy field mirrors base for DB queries
    if doc.get("variants"):
        for v in doc["variants"]:
            bp = float(v.get("price") or v.get("base_price") or 0)
            v["base_price"] = bp
            v["price"] = bp
    return doc


@api.post("/vendor/products", response_model=ProductOut)
async def vendor_create_product(payload: ProductIn, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    exists = await db.products.find_one({"slug": payload.slug})
    if exists:
        raise HTTPException(status_code=400, detail="Slug already used")
    doc = _product_payload_to_doc(payload)
    doc["created_at"] = iso_now()
    doc["vendor_id"] = str(vendor["_id"])
    doc["vendor_name"] = vendor["business_name"]
    doc["approval_status"] = "pending"
    doc["product_status"] = doc.get("product_status", "active")
    res = await db.products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return product_to_vendor_out(doc)


@api.put("/vendor/products/{prod_id}", response_model=ProductOut)
async def vendor_update_product(prod_id: str, payload: ProductIn, user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    oid = safe_object_id(prod_id)
    existing = await db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing.get("vendor_id") != str(vendor["_id"]):
        raise HTTPException(status_code=403, detail="Not your product")
    update = _product_payload_to_doc(payload)
    settings = await get_platform_settings(db)
    if settings.get("product_approval_required", True):
        update["approval_status"] = "pending"
    await db.products.update_one({"_id": oid}, {"$set": update})
    doc = await db.products.find_one({"_id": oid})
    await log_audit(db, actor_id=user["id"], actor_role="vendor", action="product_update",
                    entity_type="product", entity_id=prod_id, new_value={"base_price": update.get("base_price")})
    return product_to_vendor_out(doc)


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


async def _maybe_credit_vendor_earnings(order: dict, new_status: str) -> None:
    """Credit vendor wallets when order/lines reach Delivered."""
    if new_status != "Delivered":
        return
    settings = await get_platform_settings(db)
    settlement_days = int(settings.get("settlement_days", 7))
    by_vendor: dict = {}
    for item in order.get("items", []):
        if item.get("line_status") != "Delivered":
            continue
        vid = item.get("vendor_id")
        if not vid:
            continue
        by_vendor.setdefault(vid, []).append(item)
    for vid, items in by_vendor.items():
        await credit_vendor_order_earning(
            db,
            vendor_id=vid,
            order_id=str(order["_id"]),
            line_items=items,
            settlement_days=settlement_days,
        )


# Vendor: my orders (filtered to line items owned by this vendor)
@api.get("/vendor/orders")
async def vendor_my_orders(user: dict = Depends(get_current_user)):
    vendor = await get_vendor_for_user(user)
    vid = str(vendor["_id"])
    docs = await db.orders.find({"items.vendor_id": vid}).sort("created_at", -1).to_list(1000)
    result = []
    for o in docs:
        my_items_raw = [i for i in o["items"] if i.get("vendor_id") == vid]
        vendor_items = [vendor_order_item_out(i) for i in my_items_raw]
        my_subtotal = round(sum(i["line_total"] for i in vendor_items), 2)
        line_statuses = list({i.get("line_status", "Pending") for i in my_items_raw})
        my_status = line_statuses[0] if len(line_statuses) == 1 else "Mixed"
        result.append({
            "id": str(o["_id"]),
            "created_at": o.get("created_at"),
            "customer_name": o.get("user_name"),
            "customer_phone": o["address"]["phone"],
            "address": o["address"],
            "payment_method": o["payment_method"],
            "items": vendor_items,
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
    if new_status not in VENDOR_LINE_STATUSES:
        raise HTTPException(
            status_code=403,
            detail="Vendors can only update status up to Ready. Out for delivery, delivered, and cancelled are handled by admin or delivery partner.",
        )
    oid = safe_object_id(order_id)
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    updated_items = []
    touched = False
    for i in order["items"]:
        if i.get("vendor_id") == vid:
            current = i.get("line_status", "Pending")
            if current in ("Out For Delivery", "Delivered", "Cancelled"):
                raise HTTPException(
                    status_code=403,
                    detail="This order is with delivery/admin. You cannot change its status anymore.",
                )
            vendor_index = {s: idx for idx, s in enumerate(VENDOR_LINE_STATUSES)}
            if current in vendor_index and new_status in vendor_index:
                if vendor_index[new_status] < vendor_index[current]:
                    raise HTTPException(status_code=400, detail=f"Cannot move status backward from {current} to {new_status}")
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
    previous_status = order.get("status")
    if overall != order["status"]:
        history.append({"status": overall, "at": iso_now(), "by": f"vendor:{vendor['business_name']}"})

    await db.orders.update_one(
        {"_id": oid},
        {"$set": {"items": updated_items, "status": overall, "status_history": history}},
    )
    if overall == "Cancelled" and previous_status != "Cancelled":
        await restore_order_stock(order)
    order["items"] = updated_items
    order["status"] = overall
    order["status_history"] = history
    order["_id"] = oid
    my_items_raw = [i for i in updated_items if i.get("vendor_id") == vid]
    vendor_items = [vendor_order_item_out(i) for i in my_items_raw]
    return {
        "id": str(oid),
        "status": overall,
        "items": vendor_items,
        "my_subtotal": round(sum(i["line_total"] for i in vendor_items), 2),
        "my_status": new_status,
    }


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
    base_revenue = 0.0
    pending_count = 0
    delivered_count = 0
    cancelled_count = 0
    for o in order_docs:
        for i in o["items"]:
            if i.get("vendor_id") == vid:
                ls = i.get("line_status", "Pending")
                line_base = get_order_item_base_price(i)
                qty = int(i.get("quantity") or 0)
                if ls == "Delivered":
                    base_revenue += line_base * qty
                    delivered_count += 1
                elif ls == "Pending":
                    pending_count += 1
                elif ls == "Cancelled":
                    cancelled_count += 1

    await release_pending_earnings(db, vid)
    wallet = await get_wallet_summary(db, vid)

    return {
        "vendor": vendor_to_out(vendor),
        "total_products": total_products,
        "approved_products": approved_products,
        "pending_products": pending_products,
        "total_orders": total_orders,
        "pending_orders": pending_count,
        "delivered_orders": delivered_count,
        "cancelled_orders": cancelled_count,
        "base_sales": round(base_revenue, 2),
        "wallet": wallet,
        "low_stock": [product_to_vendor_out(p) for p in low_stock],
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
            line_base = get_order_item_base_price(i)
            line_total = line_base * i["quantity"]
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

    await release_pending_earnings(db, vid)
    wallet = await get_wallet_summary(db, vid)
    pending_payment = round(wallet["available_balance"] + wallet["pending_balance"], 2)

    recent = []
    for o in all_orders[:10]:
        my_items_raw = [i for i in o["items"] if i.get("vendor_id") == vid]
        vendor_items = [vendor_order_item_out(i) for i in my_items_raw]
        my_subtotal = round(sum(i["line_total"] for i in vendor_items), 2)
        recent.append({
            "id": str(o["_id"]),
            "created_at": o.get("created_at"),
            "customer_name": o.get("user_name"),
            "items": vendor_items,
            "my_subtotal": my_subtotal,
            "overall_status": o["status"],
            "items_count": len(vendor_items),
        })

    low_stock = await db.products.find({"vendor_id": vid, "stock": {"$lt": 5}}).limit(10).to_list(10)

    return {
        "today_orders": today_orders,
        "week_orders": week_orders,
        "month_sales": round(month_revenue, 2),
        "total_sales": round(total_revenue, 2),
        "total_items_sold": total_items_sold,
        "pending_payment": pending_payment,
        "wallet": wallet,
        "best_sellers": best_sellers,
        "recent_orders": recent,
        "low_stock": [product_to_vendor_out(p) for p in low_stock],
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
            "assigned_at": iso_now(),
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
    previous_status = o.get("status")
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
    if payload.status == "Cancelled" and previous_status != "Cancelled":
        o["status"] = payload.status
        await restore_order_stock(o)
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
                    vs["net_payout"] += line_total
                    total_vendor_payout += line_total

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


@api.put("/admin/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, payload: CouponIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(coupon_id)
    existing = await db.coupons.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found")
    code = payload.code.strip().upper()
    clash = await db.coupons.find_one({"code": code, "_id": {"$ne": oid}})
    if clash:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    doc = payload.model_dump()
    doc["code"] = code
    await db.coupons.update_one({"_id": oid}, {"$set": doc})
    updated = await db.coupons.find_one({"_id": oid})
    return coupon_to_out(updated)


@api.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(coupon_id)
    res = await db.coupons.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Offers — homepage banners (admin-managed)
# ---------------------------------------------------------------------------

class OfferIn(BaseModel):
    title: str
    subtitle: str = ""
    bg_color: str = "#1B4332"
    link: Optional[str] = None
    active: bool = True
    sort_order: int = 0


def offer_to_out(o: dict) -> dict:
    return {
        "id": str(o["_id"]),
        "title": o["title"],
        "subtitle": o.get("subtitle", ""),
        "bg_color": o.get("bg_color", "#1B4332"),
        "link": o.get("link"),
        "active": o.get("active", True),
        "sort_order": o.get("sort_order", 0),
        "created_at": o.get("created_at"),
        "updated_at": o.get("updated_at"),
    }


@api.get("/offers")
async def list_active_offers():
    docs = await db.offers.find({"active": True}).sort("sort_order", 1).to_list(50)
    return [offer_to_out(o) for o in docs]


@api.get("/admin/offers")
async def admin_list_offers(_: dict = Depends(require_admin)):
    docs = await db.offers.find().sort("sort_order", 1).to_list(100)
    return [offer_to_out(o) for o in docs]


@api.post("/admin/offers")
async def create_offer(payload: OfferIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["created_at"] = iso_now()
    doc["updated_at"] = doc["created_at"]
    res = await db.offers.insert_one(doc)
    doc["_id"] = res.inserted_id
    return offer_to_out(doc)


@api.put("/admin/offers/{offer_id}")
async def update_offer(offer_id: str, payload: OfferIn, _: dict = Depends(require_admin)):
    oid = safe_object_id(offer_id)
    existing = await db.offers.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Offer not found")
    doc = payload.model_dump()
    doc["updated_at"] = iso_now()
    await db.offers.update_one({"_id": oid}, {"$set": doc})
    updated = await db.offers.find_one({"_id": oid})
    return offer_to_out(updated)


@api.delete("/admin/offers/{offer_id}")
async def delete_offer(offer_id: str, _: dict = Depends(require_admin)):
    oid = safe_object_id(offer_id)
    res = await db.offers.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
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
        "address": "Mandi Bazar, Ambajogai, Maharashtra 431517",
        "email": os.environ.get("STORE_EMAIL", "ambajogaigrocerystores@gmail.com"),
        "delivery": {
            "center_lat": DELIVERY_CENTER_LAT,
            "center_lng": DELIVERY_CENTER_LNG,
            "near_km": DELIVERY_NEAR_KM,
            "near_fee": DELIVERY_NEAR_FEE,
            "per_km": DELIVERY_PER_KM,
            "free_threshold": FREE_DELIVERY_THRESHOLD,
        },
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
    await db.vendors.create_index("owner_id")
    await db.coupons.create_index("code", unique=True)

    # Migration: ensure existing products have approval_status set (defaults to approved for legacy store products)
    await db.products.update_many({"approval_status": {"$exists": False}}, {"$set": {"approval_status": "approved"}})

    # Migration: ensure base_price field exists (legacy products used price as base)
    async for p in db.products.find({"base_price": {"$exists": False}}):
        await db.products.update_one({"_id": p["_id"]}, {"$set": {"base_price": p.get("price", 0)}})

    # Platform settings singleton
    await db.platform_settings.update_one(
        {"_id": "default"},
        {"$setOnInsert": default_platform_settings()},
        upsert=True,
    )

    # Default global pricing rule
    if await db.pricing_rules.count_documents({"rule_type": "global"}) == 0:
        await db.pricing_rules.insert_one({
            "rule_type": "global",
            "target_id": "",
            "markup_pct": 20.0,
            "active": True,
            "created_at": iso_now(),
        })

    # Indexes for new collections
    await db.wallet_transactions.create_index("vendor_id")
    await db.payouts.create_index("vendor_id")
    await db.notifications.create_index("user_id")
    await db.audit_logs.create_index("created_at")
    await db.referrals.create_index("referrer_vendor_id")

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

    # Default homepage offers (if none exist)
    if await db.offers.count_documents({}) == 0:
        default_offers = [
            {"title": "10% off", "subtitle": "on your first order", "bg_color": "#E07A5F", "link": "/products", "active": True, "sort_order": 0, "created_at": iso_now(), "updated_at": iso_now()},
            {"title": "Free delivery", "subtitle": "orders above ₹499", "bg_color": "#1B4332", "link": "/products", "active": True, "sort_order": 1, "created_at": iso_now(), "updated_at": iso_now()},
            {"title": "COD available", "subtitle": "pay on delivery", "bg_color": "#8BA888", "link": None, "active": True, "sort_order": 2, "created_at": iso_now(), "updated_at": iso_now()},
        ]
        await db.offers.insert_many(default_offers)

    logger.info("Seed data loaded.")


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------

_platform = register_platform_routes(api, db, deps={
    "get_current_user": get_current_user,
    "require_admin": require_admin,
    "get_vendor_for_user": get_vendor_for_user,
    "get_vendor_profile": get_vendor_profile,
    "vendor_to_out": vendor_to_out,
    "safe_object_id": safe_object_id,
    "VENDOR_STATUSES": VENDOR_STATUSES,
})

app.include_router(api)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
