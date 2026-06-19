"""MerchCraft AI — FastAPI backend.
Modules: auth, catalog, cart, orders, ai-design, corporate-rfq, reviews, admin, payments.
"""
import os
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MerchCraft AI")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("merchcraft")


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
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ─────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProductIn(BaseModel):
    name: str
    category: str  # slug
    description: str = ""
    base_price: float
    image: str = ""
    variants: Dict[str, List[str]] = {}  # {"size":["S","M","L"], "color":["Black","White"]}
    tags: List[str] = []
    is_active: bool = True


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
    payment_method: str = "razorpay"  # razorpay | cod | mock


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


# ─────────────────────────────────────────────────────────────
# Categories & Products
# ─────────────────────────────────────────────────────────────
@api.get("/categories")
async def list_categories():
    items = await db.categories.find({"is_active": True}, {"_id": 0}).to_list(200)
    return items


@api.post("/categories")
async def create_category(body: CategoryIn, _admin=Depends(require_admin)):
    cat = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    return cat


@api.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort: Optional[str] = "trending",
    limit: int = 60,
):
    flt: Dict[str, Any] = {"is_active": True}
    if category:
        flt["category"] = category
    if q:
        flt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    sort_map = {"trending": [("sold_count", -1)], "new": [("created_at", -1)], "price_asc": [("base_price", 1)], "price_desc": [("base_price", -1)]}
    cursor = db.products.find(flt, {"_id": 0}).sort(sort_map.get(sort or "trending", [("sold_count", -1)])).limit(limit)
    return await cursor.to_list(limit)


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


@api.delete("/products/{pid}")
async def delete_product(pid: str, _admin=Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# Cart
# ─────────────────────────────────────────────────────────────
@api.get("/cart")
async def get_cart(user: dict = Depends(require_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    # populate product info
    items = []
    for it in cart.get("items", []):
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        items.append({**it, "product": p})
    return {"items": items}


@api.post("/cart/add")
async def add_to_cart(body: CartItemIn, user: dict = Depends(require_user)):
    item = {"id": new_id(), **body.model_dump()}
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$push": {"items": item}, "$setOnInsert": {"user_id": user["id"]}},
        upsert=True,
    )
    return {"ok": True, "item_id": item["id"]}


@api.delete("/cart/item/{item_id}")
async def remove_from_cart(item_id: str, user: dict = Depends(require_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$pull": {"items": {"id": item_id}}})
    return {"ok": True}


@api.post("/cart/clear")
async def clear_cart(user: dict = Depends(require_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# Orders + Checkout
# ─────────────────────────────────────────────────────────────
@api.post("/checkout")
async def checkout(body: CheckoutIn, user: dict = Depends(require_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(400, "Cart is empty")
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    total = 0.0
    line_items = []
    for it in cart["items"]:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        amount = float(p["base_price"]) * int(it.get("quantity", 1))
        total += amount
        line_items.append({**it, "unit_price": p["base_price"], "amount": amount, "product_name": p["name"], "product_image": p.get("image", "")})

    order = {
        "id": new_id(),
        "order_number": f"MC{int(datetime.now().timestamp())}",
        "user_id": user["id"],
        "items": line_items,
        "total": round(total, 2),
        "address": body.address,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "status": "pending",
        "created_at": now_iso(),
    }

    # Razorpay path (mock if no keys, real if keys provided)
    if body.payment_method == "razorpay":
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
            # No real keys configured — proceed with mock order id for demo
            order["razorpay_order_id"] = f"order_mock_{new_id()[:12]}"

    await db.orders.insert_one(order)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    order.pop("_id", None)
    return order


@api.post("/orders/{oid}/verify-payment")
async def verify_payment(oid: str, payload: Dict[str, Any], user: dict = Depends(require_user)):
    # In production use razorpay.utility.verify_payment_signature
    await db.orders.update_one(
        {"id": oid, "user_id": user["id"]},
        {"$set": {"payment_status": "paid", "status": "processing", "payment_payload": payload}},
    )
    return {"ok": True}


@api.get("/orders")
async def my_orders(user: dict = Depends(require_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(require_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Not found")
    return o


# ─────────────────────────────────────────────────────────────
# AI Design (image gen + prompt enhance)
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
        b64 = base64.b64encode(img_bytes).decode()
        data_url = f"data:image/png;base64,{b64}"
        # save record
        rec = {"id": new_id(), "user_id": user.get("id") if user else None, "prompt": prompt, "data_url": data_url, "created_at": now_iso()}
        await db.designs.insert_one(rec)
        return {"id": rec["id"], "image": data_url, "prompt": prompt}
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
        # graceful fallback
        return {"enhanced": body.prompt}


@api.get("/designs/mine")
async def my_designs(user: dict = Depends(require_user)):
    items = await db.designs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(60)
    return items


# ─────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────
@api.get("/reviews")
async def list_reviews(product_id: Optional[str] = None):
    flt = {"product_id": product_id} if product_id else {}
    items = await db.reviews.find(flt, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api.post("/reviews")
async def create_review(body: ReviewIn, user: dict = Depends(require_user)):
    doc = {"id": new_id(), "user_id": user["id"], "user_name": user["name"], **body.model_dump(), "created_at": now_iso()}
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─────────────────────────────────────────────────────────────
# Corporate RFQ
# ─────────────────────────────────────────────────────────────
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
# Settings (admin)
# ─────────────────────────────────────────────────────────────
@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "global"}, {"_id": 0})
    if not s:
        s = {"key": "global", "razorpay_enabled": True, "stripe_enabled": False, "cod_enabled": True, "ai_model": "gpt-image-1", "seo": {"title": "MerchCraft AI — Custom Merch, Designed by AI", "description": "Design custom T-shirts, mugs, hoodies, and corporate gifts with AI artwork. Made in India.", "keywords": "custom merch india, AI design, corporate gifts, t-shirt printing"}}
        await db.settings.insert_one(s.copy())
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, _admin=Depends(require_admin)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"key": "global"}, {"$set": patch}, upsert=True)
    return await db.settings.find_one({"key": "global"}, {"_id": 0})


# ─────────────────────────────────────────────────────────────
# Admin overview
# ─────────────────────────────────────────────────────────────
@api.get("/admin/overview")
async def admin_overview(_admin=Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    revenue_agg = await db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    revenue = revenue_agg[0]["total"] if revenue_agg else 0
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    pending_rfqs = await db.rfqs.count_documents({"status": "new"})
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {
        "total_orders": total_orders,
        "revenue": revenue,
        "total_users": total_users,
        "total_products": total_products,
        "pending_rfqs": pending_rfqs,
        "recent_orders": recent_orders,
    }


@api.get("/admin/orders")
async def admin_all_orders(_admin=Depends(require_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.put("/admin/orders/{oid}/status")
async def admin_update_order_status(oid: str, body: Dict[str, str], _admin=Depends(require_admin)):
    status = body.get("status")
    if status not in {"pending", "paid", "processing", "design_approved", "printing", "packed", "shipped", "delivered", "cancelled", "returned"}:
        raise HTTPException(400, "Invalid status")
    await db.orders.update_one({"id": oid}, {"$set": {"status": status}})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# Seed
# ─────────────────────────────────────────────────────────────
@api.post("/seed")
async def seed():
    if await db.products.count_documents({}) > 0:
        return {"ok": True, "msg": "already seeded"}

    # Admin user
    if not await db.users.find_one({"email": "admin@merchcraft.in"}):
        await db.users.insert_one({
            "id": new_id(),
            "email": "admin@merchcraft.in",
            "name": "Admin",
            "password_hash": bcrypt.hashpw(b"Admin@123", bcrypt.gensalt()).decode(),
            "role": "admin",
            "created_at": now_iso(),
        })
    # Demo customer
    if not await db.users.find_one({"email": "demo@merchcraft.in"}):
        await db.users.insert_one({
            "id": new_id(),
            "email": "demo@merchcraft.in",
            "name": "Demo User",
            "password_hash": bcrypt.hashpw(b"Demo@123", bcrypt.gensalt()).decode(),
            "role": "customer",
            "created_at": now_iso(),
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

    products = [
        ("Classic Cotton Tee", "t-shirts", 499, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80", {"size": ["S", "M", "L", "XL", "XXL"], "color": ["Black", "White", "Navy", "Olive"], "fabric": ["100% Cotton", "Cotton Blend"]}),
        ("Premium Heavyweight Tee", "t-shirts", 799, "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=1200&q=80", {"size": ["S", "M", "L", "XL"], "color": ["Black", "Sand", "Forest"]}),
        ("Oversized Drop-Shoulder Tee", "t-shirts", 899, "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&q=80", {"size": ["M", "L", "XL"], "color": ["Black", "Beige"]}),
        ("Pullover Hoodie", "hoodies", 1499, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80", {"size": ["S", "M", "L", "XL"], "color": ["Black", "Grey", "Maroon"]}),
        ("Zip-Up Hoodie", "hoodies", 1699, "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1200&q=80", {"size": ["M", "L", "XL"], "color": ["Black", "Navy"]}),
        ("Ceramic Coffee Mug 350ml", "mugs", 299, "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1200&q=80", {"capacity": ["350ml"], "color": ["White", "Black-inside"]}),
        ("Magic Color-Change Mug", "mugs", 449, "https://images.unsplash.com/photo-1481833761820-0509d3217039?w=1200&q=80", {"capacity": ["330ml"], "color": ["Black-to-White"]}),
        ("iPhone 15 Pro Case", "mobile-covers", 399, "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=1200&q=80", {"finish": ["Matte", "Glossy"]}),
        ("Samsung S24 Case", "mobile-covers", 399, "https://images.unsplash.com/photo-1592890288564-76628a30a657?w=1200&q=80", {"finish": ["Matte", "Glossy"]}),
        ("A3 Matte Poster", "posters", 249, "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80", {"size": ["A4", "A3", "A2"]}),
        ("Heavy Canvas Tote", "tote-bags", 349, "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1200&q=80", {"color": ["Natural", "Black"]}),
        ("Snapback Cap", "caps", 449, "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=1200&q=80", {"color": ["Black", "White", "Khaki"]}),
        ("Employee Welcome Kit", "corporate-gifts", 1999, "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&q=80", {"variant": ["Standard", "Premium"]}),
        ("Custom Stainless Tumbler", "corporate-gifts", 899, "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1200&q=80", {"capacity": ["500ml", "750ml"], "color": ["Silver", "Black"]}),
    ]
    for name, cat, price, img, var in products:
        await db.products.insert_one({
            "id": new_id(),
            "name": name,
            "category": cat,
            "description": f"Premium quality {name.lower()} with full customization. Ships across India in 3–5 business days.",
            "base_price": price,
            "image": img,
            "variants": var,
            "tags": [cat],
            "is_active": True,
            "sold_count": __import__("random").randint(20, 400),
            "created_at": now_iso(),
        })

    # Seed reviews
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

    # default settings
    if not await db.settings.find_one({"key": "global"}):
        await db.settings.insert_one({
            "key": "global",
            "razorpay_enabled": True, "stripe_enabled": False, "cod_enabled": True,
            "ai_model": "gpt-image-1",
            "seo": {
                "title": "MerchCraft AI — Custom Merch, Designed by AI",
                "description": "Design custom T-shirts, mugs, hoodies, and corporate gifts with AI artwork. Made in India.",
                "keywords": "custom merch india, AI design, corporate gifts, t-shirt printing",
            },
        })

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
    # Auto-seed on first boot
    if await db.products.count_documents({}) == 0:
        try:
            await seed()
        except Exception as e:
            logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()
