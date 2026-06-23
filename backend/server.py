"""MerchCraft AI — FastAPI backend.

Adds in this iteration:
  • Guest checkout + phone-OTP verification
  • Marketing opt-in + broadcast notifications (mock send → notifications_log)
  • Order-status notification scheduler (APScheduler daily cron, configurable hour)
  • Customisable templates (order_placed / status_change / broadcast / guest_welcome)
  • Auto-bestseller cron + bestseller-out-of-stock admin alert
  • CSV bulk-import sample download
  • "Add color" variant-image flow handled implicitly via PUT /products/{id}
"""
import os
import uuid
import base64
import csv
import io
import logging
import random
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Optional S3-compatible storage
S3_ENDPOINT = os.environ.get("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")
S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_PUBLIC_BASE = os.environ.get("S3_PUBLIC_BASE", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MerchCraft AI")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("merchcraft")
scheduler = AsyncIOScheduler()


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def jwt_encode(payload: dict) -> str:
    payload = {**payload, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def jwt_decode(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


async def current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        data = jwt_decode(token)
        user = await db.users.find_one({"id": data.get("uid")}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None


async def require_user(user: Optional[dict] = Depends(current_user)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_admin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_superadmin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return user


def upload_to_storage(data: bytes, key: str, content_type: str = "image/png") -> Optional[str]:
    if not (S3_ENDPOINT and S3_ACCESS_KEY and S3_SECRET_KEY and S3_BUCKET):
        return None
    try:
        import boto3  # noqa
        s3 = boto3.client("s3", endpoint_url=S3_ENDPOINT,
                          aws_access_key_id=S3_ACCESS_KEY,
                          aws_secret_access_key=S3_SECRET_KEY, region_name="us-east-1")
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type, ACL="public-read")
        base = S3_PUBLIC_BASE or f"{S3_ENDPOINT.rstrip('/')}/{S3_BUCKET}"
        return f"{base.rstrip('/')}/{key}"
    except Exception as e:
        logger.exception("S3 upload failed: %s", e)
        return None


# ─────────────────────────────────────────────────────────────
# Templates (default content) — admin-customisable via /admin/templates
# ─────────────────────────────────────────────────────────────
DEFAULT_TEMPLATES = {
    "order_placed_email": {
        "subject": "Order received — {order_number}",
        "body": "Hi {name},\n\nThanks for your order {order_number} of ₹{total}. We've received it and it's now being processed.\n\nWe'll send you updates as we go. — MerchCraft AI"
    },
    "order_placed_sms": {
        "body": "MerchCraft: order {order_number} of ₹{total} received. We'll update you shortly."
    },
    "order_placed_whatsapp": {
        "body": "🎉 *MerchCraft AI* — your order *{order_number}* of ₹{total} is confirmed and being processed. Track: merchcraft.in/account"
    },
    "status_change_email": {
        "subject": "Order {order_number} is now {status}",
        "body": "Hi {name},\n\nYour order {order_number} status has been updated to: *{status}*.\n\n— MerchCraft AI"
    },
    "status_change_sms": {
        "body": "MerchCraft: order {order_number} → {status}"
    },
    "status_change_whatsapp": {
        "body": "📦 *MerchCraft AI* — order *{order_number}* is now *{status}*."
    },
    "guest_welcome_email": {
        "subject": "Welcome to MerchCraft AI — your account is ready",
        "body": "Hi {name},\n\nWe created an account for you so you can track your order {order_number}.\n\nEmail: {email}\nTemp password: {password}\n\nChange it any time at merchcraft.in/account. — MerchCraft AI"
    },
    "broadcast_default": {
        "subject": "News from MerchCraft AI",
        "body": "Hello {name}, check out what's new at MerchCraft AI."
    },
    "otp_sms": {"body": "MerchCraft OTP: {code}. Valid for 10 minutes."},
    "otp_email": {"subject": "Your MerchCraft verification code", "body": "Your verification code is {code}. It expires in 10 minutes."},
}


# ─────────────────────────────────────────────────────────────
# Notification senders — MOCKED (logged to notifications_log)
# ─────────────────────────────────────────────────────────────
async def _log_notification(channel: str, target: str, subject: str, body: str, meta: dict = None) -> str:
    nid = new_id()
    await db.notifications_log.insert_one({
        "id": nid, "channel": channel, "target": target,
        "subject": subject, "body": body, "status": "sent",
        "meta": meta or {}, "created_at": now_iso(),
    })
    logger.info("[NOTIFY %s → %s] %s | %s", channel.upper(), target, subject or "", body[:120])
    return nid


def _fill_template(tpl: dict, ctx: dict) -> dict:
    out = {}
    for k, v in tpl.items():
        try:
            out[k] = v.format(**ctx)
        except Exception:
            out[k] = v
    return out


async def send_order_placed_notifications(order: dict, user_doc: Optional[dict]):
    """Send order_placed via every channel the customer is eligible for."""
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    templates = settings.get("templates", DEFAULT_TEMPLATES)
    snapshot = order.get("customer_snapshot") or {}
    name = (user_doc.get("name") if user_doc else None) or snapshot.get("name") or "there"
    email = (user_doc.get("email") if user_doc else None) or snapshot.get("email")
    phone = (user_doc.get("phone") if user_doc else None) or snapshot.get("phone")
    email_verified = user_doc.get("email_verified", False) if user_doc else snapshot.get("email_verified", False)
    phone_verified = user_doc.get("phone_verified", False) if user_doc else snapshot.get("phone_verified", False)
    ctx = {"name": name, "order_number": order["order_number"], "total": order["total"], "status": order["status"]}

    sent = []
    # Email — only to verified email
    if email and email_verified:
        t = _fill_template(templates.get("order_placed_email", DEFAULT_TEMPLATES["order_placed_email"]), ctx)
        sent.append(await _log_notification("email", email, t.get("subject", ""), t.get("body", ""), {"order_id": order["id"]}))
    # SMS — only to verified phone
    if phone and phone_verified:
        t = _fill_template(templates.get("order_placed_sms", DEFAULT_TEMPLATES["order_placed_sms"]), ctx)
        sent.append(await _log_notification("sms", phone, "", t.get("body", ""), {"order_id": order["id"]}))
    # WhatsApp — to ANY valid phone (verified or not, per spec)
    if phone:
        t = _fill_template(templates.get("order_placed_whatsapp", DEFAULT_TEMPLATES["order_placed_whatsapp"]), ctx)
        sent.append(await _log_notification("whatsapp", phone, "", t.get("body", ""), {"order_id": order["id"]}))
    return sent


async def send_status_update_notifications(order: dict, channels: Optional[List[str]] = None, user_doc: Optional[dict] = None):
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    templates = settings.get("templates", DEFAULT_TEMPLATES)
    snapshot = order.get("customer_snapshot") or {}
    if not user_doc and order.get("user_id"):
        user_doc = await db.users.find_one({"id": order["user_id"]}, {"_id": 0, "password_hash": 0})
    name = (user_doc.get("name") if user_doc else None) or snapshot.get("name") or "there"
    email = (user_doc.get("email") if user_doc else None) or snapshot.get("email")
    phone = (user_doc.get("phone") if user_doc else None) or snapshot.get("phone")
    email_verified = (user_doc or {}).get("email_verified") or snapshot.get("email_verified", False)
    phone_verified = (user_doc or {}).get("phone_verified") or snapshot.get("phone_verified", False)
    ctx = {"name": name, "order_number": order["order_number"], "total": order["total"], "status": order["status"]}

    use_channels = channels or ["email", "sms", "whatsapp"]
    sent = []
    if "email" in use_channels and email and email_verified:
        t = _fill_template(templates.get("status_change_email", DEFAULT_TEMPLATES["status_change_email"]), ctx)
        sent.append(await _log_notification("email", email, t.get("subject", ""), t.get("body", ""), {"order_id": order["id"]}))
    if "sms" in use_channels and phone and phone_verified:
        t = _fill_template(templates.get("status_change_sms", DEFAULT_TEMPLATES["status_change_sms"]), ctx)
        sent.append(await _log_notification("sms", phone, "", t.get("body", ""), {"order_id": order["id"]}))
    if "whatsapp" in use_channels and phone:
        t = _fill_template(templates.get("status_change_whatsapp", DEFAULT_TEMPLATES["status_change_whatsapp"]), ctx)
        sent.append(await _log_notification("whatsapp", phone, "", t.get("body", ""), {"order_id": order["id"]}))
    return sent


# ─────────────────────────────────────────────────────────────
# Scheduler jobs
# ─────────────────────────────────────────────────────────────
async def job_daily_status_notifications():
    """Run daily: for any order whose status changed since last_notified_status, send updates."""
    logger.info("[scheduler] daily status notifications running")
    cursor = db.orders.find({})
    count = 0
    async for o in cursor:
        last = o.get("last_notified_status")
        if last != o.get("status"):
            await send_status_update_notifications(o)
            await db.orders.update_one({"id": o["id"]}, {"$set": {"last_notified_status": o.get("status")}})
            count += 1
    logger.info("[scheduler] sent status notifications for %d orders", count)


async def job_auto_bestseller():
    """Auto-mark bestseller for products in active categories with sold_count above threshold."""
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    threshold = int(settings.get("bestseller_threshold", 200))
    active_cats = [c["slug"] async for c in db.categories.find({"is_active": True}, {"_id": 0, "slug": 1})]
    promoted = await db.products.update_many(
        {"sold_count": {"$gte": threshold}, "category": {"$in": active_cats}, "is_bestseller": False, "is_active": True},
        {"$set": {"is_bestseller": True, "auto_marked_bestseller_at": now_iso()}}
    )
    logger.info("[scheduler] auto-bestseller promoted %d products (threshold %d)", promoted.modified_count, threshold)
    # Alert (deduplicated): bestsellers with low_stock
    low_count = await db.products.count_documents({"is_bestseller": True, "low_stock": True, "is_active": True})
    if low_count > 0:
        # Skip if same unread alert already exists
        existing = await db.admin_alerts.find_one({"type": "bestseller_low_stock", "read": False, "count": low_count})
        if not existing:
            await db.admin_alerts.insert_one({
                "id": new_id(),
                "type": "bestseller_low_stock",
                "message": f"{low_count} bestseller(s) marked as 'Few units left'. Restock recommended.",
                "count": low_count,
                "created_at": now_iso(),
                "read": False,
            })


async def reschedule_status_job(hour: int):
    """Reschedule the daily status job with a new hour. Called when admin updates settings."""
    try:
        scheduler.remove_job("daily-status")
    except Exception:
        pass
    scheduler.add_job(job_daily_status_notifications, CronTrigger(hour=hour, minute=0),
                      id="daily-status", replace_existing=True)


# ─────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    marketing_opt_in: bool = True


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProductIn(BaseModel):
    name: str
    category: str
    description: str = ""
    base_price: float
    image: str = ""
    variants: Dict[str, List[str]] = {}
    variant_images: Dict[str, Dict[str, str]] = {}
    tags: List[str] = []
    is_active: bool = True
    is_bestseller: bool = False
    low_stock: bool = False
    watching_count: int = 0


class CategoryIn(BaseModel):
    slug: str
    name: str
    image: str = ""
    is_active: bool = True


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = 1
    variants: Dict[str, str] = {}
    custom_design_url: Optional[str] = None
    custom_text: Optional[str] = None


class CheckoutIn(BaseModel):
    address: Dict[str, str]
    payment_method: str = "razorpay"


class GuestCheckoutIn(BaseModel):
    items: List[CartItemIn]
    customer: Dict[str, str]   # {name, email, phone, address fields…}
    payment_method: str = "cod"
    register: bool = False
    marketing_opt_in: bool = True
    phone_otp_code: str        # required for guest


class OTPSendIn(BaseModel):
    target: str   # phone or email
    channel: str  # 'sms' | 'email' | 'whatsapp'


class OTPVerifyIn(BaseModel):
    target: str
    code: str


class AIPromptIn(BaseModel):
    prompt: str
    style: Optional[str] = None


class PromptEnhanceIn(BaseModel):
    prompt: str


class CorporateRFQIn(BaseModel):
    company: str
    contact_name: str
    email: EmailStr
    phone: str
    products: str
    quantity: int
    delivery_location: str
    logo_url: Optional[str] = None
    notes: str = ""
    kit_choice: Optional[str] = None   # "standard" / "premium" / "elite" / "custom"


class ReviewIn(BaseModel):
    product_id: str
    rating: int = Field(ge=1, le=5)
    comment: str
    image_url: Optional[str] = None


class SettingsIn(BaseModel):
    razorpay_enabled: Optional[bool] = None
    stripe_enabled: Optional[bool] = None
    cod_enabled: Optional[bool] = None
    ai_model: Optional[str] = None
    seo: Optional[Dict[str, Any]] = None
    free_shipping_threshold: Optional[int] = None
    bestseller_threshold: Optional[int] = None
    scheduler_hour: Optional[int] = None
    templates: Optional[Dict[str, Any]] = None


class AdminCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class FlagsIn(BaseModel):
    is_bestseller: Optional[bool] = None
    low_stock: Optional[bool] = None


class BroadcastIn(BaseModel):
    subject: str = ""
    body: str
    channels: List[str] = ["email", "sms", "whatsapp"]


class NotifyOrderIn(BaseModel):
    channels: List[str] = ["email", "whatsapp"]


class TriggerVerificationIn(BaseModel):
    channel: str  # 'sms' | 'email'


class PreferencesIn(BaseModel):
    marketing_opt_in: Optional[bool] = None
    phone: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "id": new_id(),
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": pw_hash,
        "phone": body.phone or "",
        "phone_verified": False,
        "email_verified": False,
        "marketing_opt_in": body.marketing_opt_in,
        "is_guest": False,
        "role": "customer",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = jwt_encode({"uid": user["id"]})
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")}}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = jwt_encode({"uid": user["id"]})
    safe_user = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"token": token, "user": safe_user}


@api.get("/auth/me")
async def me(user: dict = Depends(require_user)):
    return user


@api.patch("/auth/me/preferences")
async def update_preferences(body: PreferencesIn, user: dict = Depends(require_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "Nothing to update")
    if "phone" in patch:
        patch["phone_verified"] = False  # require re-verification when phone changes
    await db.users.update_one({"id": user["id"]}, {"$set": patch})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})


# ─────────────────────────────────────────────────────────────
# OTP
# ─────────────────────────────────────────────────────────────
@api.post("/auth/send-otp")
async def send_otp(body: OTPSendIn):
    code = f"{random.randint(0, 999999):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.otps.insert_one({
        "id": new_id(), "target": body.target, "channel": body.channel,
        "code": code, "verified": False, "expires_at": expires, "created_at": now_iso(),
    })
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    templates = settings.get("templates", DEFAULT_TEMPLATES)
    if body.channel == "email":
        t = _fill_template(templates.get("otp_email", DEFAULT_TEMPLATES["otp_email"]), {"code": code})
        await _log_notification("email", body.target, t.get("subject", ""), t.get("body", ""), {"kind": "otp"})
    else:
        t = _fill_template(templates.get("otp_sms", DEFAULT_TEMPLATES["otp_sms"]), {"code": code})
        await _log_notification(body.channel, body.target, "", t.get("body", ""), {"kind": "otp"})
    # Return code in dev mode (no real SMS provider configured). Strip in production.
    return {"sent": True, "dev_code": code}


@api.post("/auth/verify-otp")
async def verify_otp(body: OTPVerifyIn):
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.otps.find_one({"target": body.target, "code": body.code, "verified": False, "expires_at": {"$gt": now}}, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(400, "Invalid or expired code")
    await db.otps.update_one({"id": doc["id"]}, {"$set": {"verified": True, "verified_at": now_iso()}})
    # If a logged-in user owns this target, mark them verified
    if "@" in body.target:
        await db.users.update_one({"email": body.target.lower()}, {"$set": {"email_verified": True}})
    else:
        await db.users.update_one({"phone": body.target}, {"$set": {"phone_verified": True}})
    return {"verified": True, "channel": "email" if "@" in body.target else "phone"}


async def _has_verified_phone(phone: str) -> bool:
    """Has there been a verified OTP for this phone in the last 30 minutes?"""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    doc = await db.otps.find_one({"target": phone, "verified": True, "verified_at": {"$gt": cutoff}})
    return bool(doc)


# ─────────────────────────────────────────────────────────────
# Categories & Products
# ─────────────────────────────────────────────────────────────
@api.get("/categories")
async def list_categories():
    return await db.categories.find({"is_active": True}, {"_id": 0}).to_list(200)


@api.get("/admin/categories")
async def admin_list_categories(_admin=Depends(require_admin)):
    return await db.categories.find({}, {"_id": 0}).to_list(500)


@api.post("/categories")
async def create_category(body: CategoryIn, _admin=Depends(require_admin)):
    cat = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    return cat


@api.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, _admin=Depends(require_admin)):
    res = await db.categories.update_one({"id": cid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.categories.find_one({"id": cid}, {"_id": 0})


@api.patch("/categories/{cid}/toggle")
async def toggle_category(cid: str, _admin=Depends(require_admin)):
    c = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    new_state = not c.get("is_active", True)
    await db.categories.update_one({"id": cid}, {"$set": {"is_active": new_state}})
    return {"id": cid, "is_active": new_state}


@api.delete("/categories/{cid}")
async def delete_category(cid: str, _admin=Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


async def _active_category_slugs() -> set:
    cats = await db.categories.find({"is_active": True}, {"_id": 0, "slug": 1}).to_list(500)
    return {c["slug"] for c in cats}


@api.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None,
                        sort: Optional[str] = "trending", limit: int = 60):
    flt: Dict[str, Any] = {"is_active": True}
    if category:
        flt["category"] = category
    if q:
        flt["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"tags": {"$regex": q, "$options": "i"}}]
    sort_map = {"trending": [("sold_count", -1)], "new": [("created_at", -1)],
                "price_asc": [("base_price", 1)], "price_desc": [("base_price", -1)]}
    cursor = db.products.find(flt, {"_id": 0}).sort(sort_map.get(sort or "trending", [("sold_count", -1)])).limit(limit)
    return await cursor.to_list(limit)


@api.get("/products/trending")
async def trending_products(limit: int = 6):
    active = await _active_category_slugs()
    cursor = db.products.find({"is_active": True, "category": {"$in": list(active)}}, {"_id": 0}).sort("sold_count", -1).limit(limit)
    return await cursor.to_list(limit)


@api.get("/products/bestsellers")
async def bestseller_products(limit: int = 8):
    active = await _active_category_slugs()
    cursor = db.products.find({"is_active": True, "is_bestseller": True, "category": {"$in": list(active)}}, {"_id": 0}).sort("sold_count", -1).limit(limit)
    return await cursor.to_list(limit)


@api.get("/products/sample-csv", response_class=PlainTextResponse)
async def sample_csv():
    """Downloadable starter CSV for /products/bulk-import."""
    rows = [
        "name,category,description,base_price,image,tags,is_active,is_bestseller,low_stock,variants_size,variants_color,variants_fabric",
        "Sample Cotton Tee,t-shirts,Soft 100% cotton crew-neck,499,https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200,t-shirts|cotton,true,false,false,S|M|L|XL,Black|White|Navy,100% Cotton|Cotton Blend",
        "Sample Ceramic Mug,mugs,350ml ceramic with full-wrap print,299,https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1200,mugs|ceramic,true,true,false,,White|Black-inside,",
        "Sample Hoodie,hoodies,Cozy fleece-lined hoodie,1499,,hoodies|winter,true,false,true,S|M|L|XL|XXL,Black|Grey,",
    ]
    return PlainTextResponse("\n".join(rows), headers={"Content-Disposition": 'attachment; filename="merchcraft-products-sample.csv"'})


@api.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@api.post("/products")
async def create_product(body: ProductIn, _admin=Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "sold_count": 0, "created_at": now_iso()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, _admin=Depends(require_admin)):
    res = await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.patch("/products/{pid}/flags")
async def update_product_flags(pid: str, body: FlagsIn, _admin=Depends(require_admin)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "Nothing to update")
    res = await db.products.update_one({"id": pid}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.put("/products/{pid}/watching")
async def set_watching(pid: str, body: Dict[str, int], _admin=Depends(require_admin)):
    count = int(body.get("watching_count", 0))
    if count < 0:
        raise HTTPException(400, "Must be ≥ 0")
    res = await db.products.update_one({"id": pid}, {"$set": {"watching_count": count}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True, "watching_count": count}


@api.delete("/products/{pid}")
async def delete_product(pid: str, _admin=Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@api.post("/products/bulk-import")
async def bulk_import_products(file: UploadFile = File(...), _admin=Depends(require_admin)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except Exception:
        text = raw.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors: List[str] = []
    for i, row in enumerate(reader, 2):
        try:
            if not row.get("name") or not row.get("category") or not row.get("base_price"):
                errors.append(f"Row {i}: missing name/category/base_price")
                continue
            variants = {}
            for key, val in row.items():
                if key and key.startswith("variants_") and val:
                    vk = key.replace("variants_", "")
                    variants[vk] = [v.strip() for v in val.split("|") if v.strip()]
            doc = {
                "id": new_id(),
                "name": row["name"].strip(),
                "category": row["category"].strip(),
                "description": row.get("description", "").strip(),
                "base_price": float(row["base_price"]),
                "image": row.get("image", "").strip(),
                "variants": variants,
                "variant_images": {},
                "tags": [t.strip() for t in row.get("tags", "").split("|") if t.strip()],
                "is_active": row.get("is_active", "true").strip().lower() != "false",
                "is_bestseller": row.get("is_bestseller", "false").strip().lower() == "true",
                "low_stock": row.get("low_stock", "false").strip().lower() == "true",
                "watching_count": 0, "sold_count": 0, "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
            created += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")
    return {"created": created, "errors": errors}


# ─────────────────────────────────────────────────────────────
# Cart (logged-in users only — guests use client-side cart)
# ─────────────────────────────────────────────────────────────
@api.get("/cart")
async def get_cart(user: dict = Depends(require_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    items = []
    for it in cart.get("items", []):
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        items.append({**it, "product": p})
    return {"items": items}


@api.post("/cart/add")
async def add_to_cart(body: CartItemIn, user: dict = Depends(require_user)):
    item = {"id": new_id(), **body.model_dump()}
    await db.carts.update_one({"user_id": user["id"]},
                              {"$push": {"items": item}, "$setOnInsert": {"user_id": user["id"]}}, upsert=True)
    return {"ok": True, "item_id": item["id"]}


@api.delete("/cart/item/{item_id}")
async def remove_from_cart(item_id: str, user: dict = Depends(require_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$pull": {"items": {"id": item_id}}})
    return {"ok": True}


@api.put("/cart/item/{item_id}")
async def update_cart_item(item_id: str, body: Dict[str, Any], user: dict = Depends(require_user)):
    qty = int(body.get("quantity", 1))
    if qty < 1:
        raise HTTPException(400, "Quantity must be ≥ 1")
    await db.carts.update_one({"user_id": user["id"], "items.id": item_id},
                              {"$set": {"items.$.quantity": qty}})
    return {"ok": True}


@api.post("/cart/clear")
async def clear_cart(user: dict = Depends(require_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# Orders + Checkout (registered + guest)
# ─────────────────────────────────────────────────────────────
async def _build_line_items(cart_items: List[dict]) -> tuple:
    total = 0.0
    line_items = []
    for it in cart_items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        qty = int(it.get("quantity", 1))
        amount = float(p["base_price"]) * qty
        total += amount
        line_items.append({**it, "unit_price": p["base_price"], "amount": amount,
                           "product_name": p["name"], "product_image": p.get("image", "")})
    return total, line_items


async def _finalize_order(order: dict, payment_method: str, settings: dict, total: float):
    if payment_method == "razorpay":
        rzp_id = os.environ.get("RAZORPAY_KEY_ID", "")
        rzp_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
        if settings.get("razorpay_enabled", True) is False:
            raise HTTPException(400, "Razorpay disabled by admin")
        if rzp_id and rzp_secret:
            try:
                import razorpay  # type: ignore
                rzp = razorpay.Client(auth=(rzp_id, rzp_secret))
                rzp_order = rzp.order.create({"amount": int(total * 100), "currency": "INR", "payment_capture": "1"})
                order["razorpay_order_id"] = rzp_order["id"]
            except Exception as e:
                logger.exception("Razorpay error: %s", e)
                order["razorpay_order_id"] = f"order_mock_{new_id()[:12]}"
        else:
            order["razorpay_order_id"] = f"order_mock_{new_id()[:12]}"
    elif payment_method == "cod":
        if settings.get("cod_enabled", True) is False:
            raise HTTPException(400, "Cash on Delivery disabled by admin")


@api.post("/checkout")
async def checkout(body: CheckoutIn, user: dict = Depends(require_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(400, "Cart is empty")
    # For registered users placing their first order, require phone verification
    if not user.get("phone_verified"):
        raise HTTPException(412, "Phone verification required before placing your first order")
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    total, line_items = await _build_line_items(cart["items"])
    threshold = int(settings.get("free_shipping_threshold", 999))
    shipping_cost = 0 if total >= threshold else 49
    grand_total = round(total + shipping_cost, 2)

    order = {
        "id": new_id(),
        "order_number": f"MC{int(datetime.now().timestamp())}",
        "user_id": user["id"],
        "is_guest_order": False,
        "items": line_items,
        "subtotal": round(total, 2),
        "shipping_cost": shipping_cost,
        "total": grand_total,
        "address": body.address,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "status": "pending",
        "last_notified_status": None,
        "created_at": now_iso(),
    }
    await _finalize_order(order, body.payment_method, settings, grand_total)
    await db.orders.insert_one(order)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    await send_order_placed_notifications(order, user)
    await db.orders.update_one({"id": order["id"]}, {"$set": {"last_notified_status": order["status"]}})
    order.pop("_id", None)
    return order


@api.post("/checkout/guest")
async def guest_checkout(body: GuestCheckoutIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    cust = body.customer or {}
    if not (cust.get("name") and cust.get("email") and cust.get("phone")):
        raise HTTPException(400, "Name, email, and phone are required")
    # Verify the OTP was passed and accepted recently
    now = datetime.now(timezone.utc).isoformat()
    otp_doc = await db.otps.find_one({"target": cust["phone"], "code": body.phone_otp_code, "verified": True})
    if not otp_doc:
        # Try to verify now
        valid = await db.otps.find_one({"target": cust["phone"], "code": body.phone_otp_code, "verified": False, "expires_at": {"$gt": now}}, sort=[("created_at", -1)])
        if not valid:
            raise HTTPException(400, "Invalid or expired phone OTP")
        await db.otps.update_one({"id": valid["id"]}, {"$set": {"verified": True, "verified_at": now_iso()}})

    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    total, line_items = await _build_line_items([it.model_dump() for it in body.items])
    threshold = int(settings.get("free_shipping_threshold", 999))
    shipping_cost = 0 if total >= threshold else 49
    grand_total = round(total + shipping_cost, 2)

    # Find or create user account
    email = cust["email"].lower()
    existing = await db.users.find_one({"email": email})
    generated_password = None
    if existing:
        user_doc = existing
    else:
        generated_password = secrets.token_urlsafe(8)
        user_doc = {
            "id": new_id(),
            "email": email,
            "name": cust["name"],
            "password_hash": bcrypt.hashpw(generated_password.encode(), bcrypt.gensalt()).decode(),
            "phone": cust["phone"],
            "phone_verified": True,
            "email_verified": False,
            "marketing_opt_in": body.marketing_opt_in,
            "is_guest": not body.register,
            "role": "customer",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user_doc)
    # Always mark phone verified (since OTP just passed)
    await db.users.update_one({"id": user_doc["id"]}, {"$set": {"phone_verified": True}})

    address = {
        "name": cust.get("name", ""), "phone": cust.get("phone", ""),
        "line1": cust.get("line1", ""), "city": cust.get("city", ""),
        "state": cust.get("state", ""), "pincode": cust.get("pincode", ""),
    }

    order = {
        "id": new_id(),
        "order_number": f"MC{int(datetime.now().timestamp())}",
        "user_id": user_doc["id"],
        "is_guest_order": not body.register,
        "customer_snapshot": {
            "name": cust["name"], "email": email, "phone": cust["phone"],
            "phone_verified": True, "email_verified": False,
        },
        "items": line_items,
        "subtotal": round(total, 2),
        "shipping_cost": shipping_cost,
        "total": grand_total,
        "address": address,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "status": "pending",
        "last_notified_status": None,
        "created_at": now_iso(),
    }
    await _finalize_order(order, body.payment_method, settings, grand_total)
    await db.orders.insert_one(order)
    await send_order_placed_notifications(order, user_doc)
    await db.orders.update_one({"id": order["id"]}, {"$set": {"last_notified_status": order["status"]}})

    # If we generated a password, send welcome email
    if generated_password:
        templates = settings.get("templates", DEFAULT_TEMPLATES)
        ctx = {"name": cust["name"], "email": email, "password": generated_password, "order_number": order["order_number"]}
        t = _fill_template(templates.get("guest_welcome_email", DEFAULT_TEMPLATES["guest_welcome_email"]), ctx)
        await _log_notification("email", email, t.get("subject", ""), t.get("body", ""), {"kind": "guest_welcome", "order_id": order["id"]})

    order.pop("_id", None)
    return {**order, "generated_password": generated_password}


@api.post("/orders/{oid}/verify-payment")
async def verify_payment(oid: str, payload: Dict[str, Any], user: Optional[dict] = Depends(current_user)):
    # Allow guests too — by order_id only
    q = {"id": oid}
    if user:
        q = {"id": oid, "user_id": user["id"]}
    await db.orders.update_one(q, {"$set": {"payment_status": "paid", "status": "processing", "payment_payload": payload}})
    return {"ok": True}


@api.get("/orders")
async def my_orders(user: dict = Depends(require_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(require_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    return o


# ─────────────────────────────────────────────────────────────
# AI Design
# ─────────────────────────────────────────────────────────────
@api.post("/ai/generate-image")
async def generate_image(body: AIPromptIn, user: Optional[dict] = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI key not configured")
    prompt = body.prompt
    if body.style:
        prompt = f"{prompt}, {body.style} style, high quality, detailed, suitable for merchandise printing"
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        img_bytes = images[0]
        rec_id = new_id()
        url = upload_to_storage(img_bytes, f"ai-designs/{rec_id}.png")
        if not url:
            b64 = base64.b64encode(img_bytes).decode()
            url = f"data:image/png;base64,{b64}"
        rec = {"id": rec_id, "user_id": user.get("id") if user else None,
               "prompt": prompt, "data_url": url, "created_at": now_iso()}
        await db.designs.insert_one(rec)
        return {"id": rec["id"], "image": url, "prompt": prompt}
    except Exception as e:
        logger.exception("AI image gen failed: %s", e)
        raise HTTPException(500, f"AI generation failed: {str(e)}")


@api.post("/ai/enhance-prompt")
async def enhance_prompt(body: PromptEnhanceIn):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI key not configured")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=new_id(), system_message=(
            "You are an expert prompt engineer for AI image generation for merchandise printing. "
            "Rewrite user prompts to be vivid, detailed, and suitable for print-on-demand. "
            "Keep them under 60 words. Respond with only the enhanced prompt."
        )).with_model("openai", "gpt-4o-mini")
        out = await chat.send_message(UserMessage(text=body.prompt))
        return {"enhanced": out.strip()}
    except Exception as e:
        logger.exception("Prompt enhance failed: %s", e)
        return {"enhanced": body.prompt}


@api.get("/designs/mine")
async def my_designs(user: dict = Depends(require_user)):
    return await db.designs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(60)


# ─────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────
@api.get("/reviews")
async def list_reviews(product_id: Optional[str] = None):
    flt = {"product_id": product_id} if product_id else {}
    return await db.reviews.find(flt, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.post("/reviews")
async def create_review(body: ReviewIn, user: dict = Depends(require_user)):
    doc = {"id": new_id(), "user_id": user["id"], "user_name": user["name"], **body.model_dump(), "created_at": now_iso()}
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─────────────────────────────────────────────────────────────
# Corporate RFQ + Kits
# ─────────────────────────────────────────────────────────────
CORPORATE_KITS = [
    {
        "slug": "standard",
        "name": "Standard Welcome Kit",
        "price_from": 799,
        "image": "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=900&q=80",
        "includes": ["Branded cotton T-shirt", "Ceramic mug", "Notebook & pen", "Tote bag"],
        "lead_time": "5–7 days",
    },
    {
        "slug": "premium",
        "name": "Premium Onboarding Kit",
        "price_from": 1999,
        "image": "https://images.unsplash.com/photo-1571867424488-4565932edb41?w=900&q=80",
        "includes": ["Premium hoodie", "Stainless tumbler 750ml", "Hardcover diary", "Custom keychain", "Eco tote bag", "Greeting card"],
        "lead_time": "7–10 days",
    },
    {
        "slug": "elite",
        "name": "Elite Executive Kit",
        "price_from": 3499,
        "image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80",
        "includes": ["Premium jacket", "Leather portfolio", "Insulated bottle", "Wireless charger", "Branded power bank", "Bluetooth speaker"],
        "lead_time": "10–14 days",
    },
]


@api.get("/corporate/kits")
async def list_corporate_kits():
    return {"kits": CORPORATE_KITS, "customizable": True,
            "customize_note": "Talk to our team to mix products, choose colors, add logos, and set quantities. We'll send a tailored quote in 24 hours."}


@api.post("/corporate/rfq")
async def submit_rfq(body: CorporateRFQIn):
    doc = {"id": new_id(), **body.model_dump(), "status": "new", "created_at": now_iso()}
    await db.rfqs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/corporate/rfq")
async def list_rfqs(_admin=Depends(require_admin)):
    return await db.rfqs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ─────────────────────────────────────────────────────────────
# Settings
# ─────────────────────────────────────────────────────────────
DEFAULT_SETTINGS = {
    "key": "global",
    "razorpay_enabled": True,
    "stripe_enabled": False,
    "cod_enabled": True,
    "ai_model": "gpt-image-1",
    "free_shipping_threshold": 999,
    "bestseller_threshold": 200,
    "scheduler_hour": 8,
    "templates": DEFAULT_TEMPLATES,
    "seo": {
        "title": "MerchCraft AI — Custom Merch, Designed by AI",
        "description": "Design custom T-shirts, mugs, hoodies, and corporate gifts with AI artwork. Made in India.",
        "keywords": "custom merch india, AI design, corporate gifts, t-shirt printing",
    },
}


@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "global"}, {"_id": 0})
    if not s:
        s = DEFAULT_SETTINGS.copy()
        await db.settings.insert_one(s.copy())
    patched = False
    for k, v in DEFAULT_SETTINGS.items():
        if k not in s:
            s[k] = v
            patched = True
    if patched:
        await db.settings.update_one({"key": "global"}, {"$set": s}, upsert=True)
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, _admin=Depends(require_admin)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"key": "global"}, {"$set": patch}, upsert=True)
    if "scheduler_hour" in patch:
        await reschedule_status_job(int(patch["scheduler_hour"]))
    return await db.settings.find_one({"key": "global"}, {"_id": 0})


# ─────────────────────────────────────────────────────────────
# Admin: overview / orders / customers / admins / notifications / broadcast
# ─────────────────────────────────────────────────────────────
@api.get("/admin/overview")
async def admin_overview(_admin=Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    revenue_agg = await db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    revenue = revenue_agg[0]["total"] if revenue_agg else 0
    total_users = await db.users.count_documents({"role": "customer"})
    total_products = await db.products.count_documents({})
    pending_rfqs = await db.rfqs.count_documents({"status": "new"})
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    unread_alerts = await db.admin_alerts.count_documents({"read": False})
    return {"total_orders": total_orders, "revenue": revenue, "total_users": total_users,
            "total_products": total_products, "pending_rfqs": pending_rfqs,
            "recent_orders": recent_orders, "unread_alerts": unread_alerts}


@api.get("/admin/alerts")
async def admin_alerts(_admin=Depends(require_admin)):
    return await db.admin_alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)


@api.patch("/admin/alerts/{aid}/read")
async def mark_alert_read(aid: str, _admin=Depends(require_admin)):
    await db.admin_alerts.update_one({"id": aid}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/admin/orders")
async def admin_all_orders(_admin=Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for o in orders:
        u = await db.users.find_one({"id": o.get("user_id")}, {"_id": 0, "password_hash": 0})
        snap = o.get("customer_snapshot", {})
        o["customer"] = {
            "name": (u and u.get("name")) or snap.get("name"),
            "email": (u and u.get("email")) or snap.get("email"),
            "phone": (u and u.get("phone")) or snap.get("phone"),
        } if (u or snap) else None
    return orders


@api.put("/admin/orders/{oid}/status")
async def admin_update_order_status(oid: str, body: Dict[str, str], _admin=Depends(require_admin)):
    status = body.get("status")
    if status not in {"pending", "paid", "processing", "design_approved", "printing", "packed", "shipped", "delivered", "cancelled", "returned"}:
        raise HTTPException(400, "Invalid status")
    await db.orders.update_one({"id": oid}, {"$set": {"status": status}})
    return {"ok": True}


@api.post("/admin/orders/{oid}/notify")
async def admin_notify_order(oid: str, body: NotifyOrderIn, _admin=Depends(require_admin)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    sent_ids = await send_status_update_notifications(o, body.channels)
    await db.orders.update_one({"id": oid}, {"$set": {"last_notified_status": o["status"]}})
    return {"sent_count": len(sent_ids), "channels": body.channels}


@api.get("/admin/users")
async def admin_list_users(_admin=Depends(require_admin)):
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        u["order_count"] = await db.orders.count_documents({"user_id": u["id"]})
    return users


@api.post("/admin/users/{uid}/trigger-verification")
async def admin_trigger_verification(uid: str, body: TriggerVerificationIn, _admin=Depends(require_admin)):
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "Not found")
    target = u.get("email") if body.channel == "email" else u.get("phone")
    if not target:
        raise HTTPException(400, f"User has no {body.channel}")
    code = f"{random.randint(0, 999999):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    await db.otps.insert_one({"id": new_id(), "target": target, "channel": body.channel,
                              "code": code, "verified": False, "expires_at": expires, "created_at": now_iso()})
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    templates = settings.get("templates", DEFAULT_TEMPLATES)
    if body.channel == "email":
        t = _fill_template(templates.get("otp_email", DEFAULT_TEMPLATES["otp_email"]), {"code": code})
        await _log_notification("email", target, t.get("subject", ""), t.get("body", ""), {"kind": "admin_triggered_otp"})
    else:
        t = _fill_template(templates.get("otp_sms", DEFAULT_TEMPLATES["otp_sms"]), {"code": code})
        await _log_notification(body.channel, target, "", t.get("body", ""), {"kind": "admin_triggered_otp"})
    return {"sent": True, "channel": body.channel, "dev_code": code}


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user: dict = Depends(require_admin)):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Not found")
    if target.get("role") != "customer":
        raise HTTPException(403, "Cannot delete admin accounts via this endpoint")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@api.get("/admin/admins")
async def list_admins(_sa=Depends(require_superadmin)):
    return await db.users.find({"role": {"$in": ["admin", "superadmin"]}}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)


@api.post("/admin/admins")
async def create_admin(body: AdminCreateIn, _sa=Depends(require_superadmin)):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered")
    user = {"id": new_id(), "email": body.email.lower(), "name": body.name,
            "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
            "role": "admin", "phone": "", "phone_verified": False, "email_verified": True,
            "marketing_opt_in": False, "is_guest": False, "created_at": now_iso()}
    await db.users.insert_one(user)
    return {k: v for k, v in user.items() if k not in ("password_hash", "_id")}


@api.delete("/admin/admins/{uid}")
async def delete_admin(uid: str, sa: dict = Depends(require_superadmin)):
    if uid == sa["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Not found")
    if target.get("role") == "superadmin":
        raise HTTPException(403, "Cannot delete a super-admin")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@api.get("/admin/notifications-log")
async def admin_notifications_log(_admin=Depends(require_admin), limit: int = 200):
    return await db.notifications_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


@api.post("/admin/broadcast")
async def admin_broadcast(body: BroadcastIn, _admin=Depends(require_admin)):
    """Send a marketing notification to all eligible users. Mocked (logged to notifications_log)."""
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).to_list(2000)
    counts = {"email": 0, "sms": 0, "whatsapp": 0}
    for u in users:
        if u.get("is_guest"):
            # guests are still notified per spec (we have their info already)
            pass
        elif not u.get("marketing_opt_in"):
            continue
        ctx = {"name": u.get("name", "there")}
        body_filled = body.body.format(**ctx) if "{" in body.body else body.body
        subj_filled = body.subject.format(**ctx) if "{" in body.subject else body.subject
        if "email" in body.channels and u.get("email") and u.get("email_verified"):
            await _log_notification("email", u["email"], subj_filled, body_filled, {"kind": "broadcast"})
            counts["email"] += 1
        if "sms" in body.channels and u.get("phone") and u.get("phone_verified"):
            await _log_notification("sms", u["phone"], "", body_filled, {"kind": "broadcast"})
            counts["sms"] += 1
        if "whatsapp" in body.channels and u.get("phone"):
            await _log_notification("whatsapp", u["phone"], "", body_filled, {"kind": "broadcast"})
            counts["whatsapp"] += 1
    await db.broadcasts.insert_one({"id": new_id(), "subject": body.subject, "body": body.body,
                                    "channels": body.channels, "counts": counts, "created_at": now_iso()})
    return {"ok": True, "counts": counts}


# Manual auto-bestseller trigger for admin (run-now button)
@api.post("/admin/run-auto-bestseller")
async def run_auto_bestseller_now(_admin=Depends(require_admin)):
    await job_auto_bestseller()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# Seed
# ─────────────────────────────────────────────────────────────
@api.post("/seed")
async def seed():
    if await db.products.count_documents({}) > 0:
        if not await db.users.find_one({"email": "superadmin@merchcraft.in"}):
            await db.users.insert_one({
                "id": new_id(), "email": "superadmin@merchcraft.in", "name": "Super Admin",
                "password_hash": bcrypt.hashpw(b"Super@123", bcrypt.gensalt()).decode(),
                "phone": "+919000000000", "phone_verified": True, "email_verified": True,
                "marketing_opt_in": True, "is_guest": False, "role": "superadmin", "created_at": now_iso(),
            })
        return {"ok": True, "msg": "already seeded"}

    users = [
        ("superadmin@merchcraft.in", "Super Admin", "Super@123", "superadmin", "+919000000000"),
        ("admin@merchcraft.in", "Admin", "Admin@123", "admin", "+919000000001"),
        ("demo@merchcraft.in", "Demo User", "Demo@123", "customer", "+919000000002"),
    ]
    for email, name, pw, role, phone in users:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": new_id(), "email": email, "name": name,
                "password_hash": bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode(),
                "phone": phone, "phone_verified": True, "email_verified": True,
                "marketing_opt_in": True, "is_guest": False, "role": role, "created_at": now_iso(),
            })

    cats = [
        ("t-shirts", "T-Shirts", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80"),
        ("hoodies", "Hoodies", "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80"),
        ("mugs", "Mugs", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1200&q=80"),
        ("mobile-covers", "Mobile Covers", "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=1200&q=80"),
        ("posters", "Posters", "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80"),
        ("tote-bags", "Tote Bags", "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1200&q=80"),
        ("caps", "Caps", "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=1200&q=80"),
        ("corporate-gifts", "Corporate Gifts", "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&q=80"),
    ]
    for slug, name, img in cats:
        await db.categories.insert_one({"id": new_id(), "slug": slug, "name": name, "image": img, "is_active": True})

    classic_tee_imgs = {"color": {
        "Black": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80",
        "White": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=1200&q=80",
        "Navy": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&q=80",
        "Olive": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=1200&q=80",
    }}
    hoodie_imgs = {"color": {
        "Black": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80",
        "Grey": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1200&q=80",
        "Maroon": "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=1200&q=80",
    }}

    products = [
        ("Classic Cotton Tee", "t-shirts", 499, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80", {"size": ["S", "M", "L", "XL", "XXL"], "color": ["Black", "White", "Navy", "Olive"], "fabric": ["100% Cotton", "Cotton Blend"]}, classic_tee_imgs, True, True),
        ("Premium Heavyweight Tee", "t-shirts", 799, "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=1200&q=80", {"size": ["S", "M", "L", "XL"], "color": ["Black", "Sand", "Forest"]}, {}, True, False),
        ("Oversized Drop-Shoulder Tee", "t-shirts", 899, "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&q=80", {"size": ["M", "L", "XL"], "color": ["Black", "Beige"]}, {}, False, False),
        ("Pullover Hoodie", "hoodies", 1499, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80", {"size": ["S", "M", "L", "XL"], "color": ["Black", "Grey", "Maroon"]}, hoodie_imgs, True, False),
        ("Zip-Up Hoodie", "hoodies", 1699, "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1200&q=80", {"size": ["M", "L", "XL"], "color": ["Black", "Navy"]}, {}, False, True),
        ("Ceramic Coffee Mug 350ml", "mugs", 299, "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1200&q=80", {"capacity": ["350ml"], "color": ["White", "Black-inside"]}, {}, True, False),
        ("Magic Color-Change Mug", "mugs", 449, "https://images.unsplash.com/photo-1481833761820-0509d3217039?w=1200&q=80", {"capacity": ["330ml"], "color": ["Black-to-White"]}, {}, False, False),
        ("iPhone 15 Pro Case", "mobile-covers", 399, "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=1200&q=80", {"finish": ["Matte", "Glossy"]}, {}, False, False),
        ("Samsung S24 Case", "mobile-covers", 399, "https://images.unsplash.com/photo-1592890288564-76628a30a657?w=1200&q=80", {"finish": ["Matte", "Glossy"]}, {}, False, False),
        ("A3 Matte Poster", "posters", 249, "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80", {"size": ["A4", "A3", "A2"]}, {}, False, False),
        ("Heavy Canvas Tote", "tote-bags", 349, "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1200&q=80", {"color": ["Natural", "Black"]}, {}, False, True),
        ("Snapback Cap", "caps", 449, "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=1200&q=80", {"color": ["Black", "White", "Khaki"]}, {}, False, False),
        ("Employee Welcome Kit", "corporate-gifts", 1999, "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&q=80", {"variant": ["Standard", "Premium"]}, {}, True, False),
        ("Custom Stainless Tumbler", "corporate-gifts", 899, "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1200&q=80", {"capacity": ["500ml", "750ml"], "color": ["Silver", "Black"]}, {}, False, False),
    ]
    for name, cat, price, img, var, varimg, bestseller, lowstock in products:
        await db.products.insert_one({
            "id": new_id(), "name": name, "category": cat,
            "description": f"Premium quality {name.lower()} with full customization. Ships across India in 3–5 business days.",
            "base_price": price, "image": img, "variants": var, "variant_images": varimg,
            "tags": [cat], "is_active": True, "is_bestseller": bestseller, "low_stock": lowstock,
            "watching_count": random.randint(0, 47), "sold_count": random.randint(20, 400),
            "created_at": now_iso(),
        })

    sample_reviews = [
        ("Priya Sharma", "t-shirts", 5, "Print quality is amazing! The colors are vibrant and the fabric is super soft.", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"),
        ("Rohit Kumar", "mugs", 5, "Magic mug works perfectly. Great gift for my wife!", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400"),
        ("Anjali Mehta", "hoodies", 4, "Great fit and thick fabric. Will order again.", None),
        ("Karan Patel", "corporate-gifts", 5, "Ordered welcome kits for 50 new joiners. Everyone loved it.", None),
        ("Sneha Iyer", "posters", 5, "AI generated artwork came out stunning. Hanging in my studio now.", "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400"),
    ]
    for name, cat, rating, comment, img in sample_reviews:
        p = await db.products.find_one({"category": cat}, {"_id": 0, "id": 1})
        if p:
            await db.reviews.insert_one({
                "id": new_id(), "user_id": "seed", "user_name": name,
                "product_id": p["id"], "rating": rating, "comment": comment,
                "image_url": img, "created_at": now_iso(),
            })

    if not await db.settings.find_one({"key": "global"}):
        await db.settings.insert_one(DEFAULT_SETTINGS.copy())

    return {"ok": True}


@api.get("/")
async def root():
    return {"name": "MerchCraft AI", "status": "ok"}


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
    if await db.products.count_documents({}) == 0:
        try:
            await seed()
        except Exception as e:
            logger.exception("Seed failed: %s", e)
    if not await db.users.find_one({"email": "superadmin@merchcraft.in"}):
        await db.users.insert_one({
            "id": new_id(), "email": "superadmin@merchcraft.in", "name": "Super Admin",
            "password_hash": bcrypt.hashpw(b"Super@123", bcrypt.gensalt()).decode(),
            "phone": "+919000000000", "phone_verified": True, "email_verified": True,
            "marketing_opt_in": True, "is_guest": False, "role": "superadmin", "created_at": now_iso(),
        })

    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or DEFAULT_SETTINGS
    hour = int(settings.get("scheduler_hour", 8))
    scheduler.add_job(job_daily_status_notifications, CronTrigger(hour=hour, minute=0),
                      id="daily-status", replace_existing=True)
    scheduler.add_job(job_auto_bestseller, CronTrigger(hour=2, minute=0),
                      id="auto-bestseller", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started: daily-status at %02d:00, auto-bestseller at 02:00", hour)


@app.on_event("shutdown")
async def shutdown():
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    client.close()
