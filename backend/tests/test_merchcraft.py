"""MerchCraft AI backend tests — auth, catalog, cart, checkout, AI, RFQ, admin."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://design-to-product-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@merchcraft.in"
ADMIN_PASS = "Admin@123"
DEMO_EMAIL = "demo@merchcraft.in"
DEMO_PASS = "Demo@123"


# ─── Fixtures ───
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_token(s):
    r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"demo login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def products(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    return r.json()


# ─── Health & Catalog ───
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "MerchCraft AI"
        assert d["status"] == "ok"

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 8
        slugs = {c["slug"] for c in cats}
        assert "t-shirts" in slugs and "mugs" in slugs

    def test_products_count(self, products):
        assert len(products) == 14

    def test_products_no_objectid(self, products):
        for p in products:
            assert "_id" not in p
            assert "id" in p and "name" in p and "base_price" in p

    def test_products_filter_category(self, s):
        r = s.get(f"{API}/products", params={"category": "t-shirts"})
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "t-shirts"

    def test_products_search(self, s):
        r = s.get(f"{API}/products", params={"q": "hoodie"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_products_sort_price_asc(self, s):
        r = s.get(f"{API}/products", params={"sort": "price_asc"})
        prices = [p["base_price"] for p in r.json()]
        assert prices == sorted(prices)

    def test_product_detail(self, products, s):
        pid = products[0]["id"]
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_product_detail_404(self, s):
        r = s.get(f"{API}/products/nonexistent")
        assert r.status_code == 404


# ─── Auth ───
class TestAuth:
    def test_login_admin(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d
        assert d["user"]["role"] == "admin"

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass@123", "name": "Test User"})
        assert r.status_code == 200
        d = r.json()
        token = d["token"]
        assert d["user"]["email"] == email
        # /me
        r2 = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["email"] == email
        assert "password_hash" not in r2.json()

    def test_register_duplicate(self, s):
        r = s.post(f"{API}/auth/register", json={"email": ADMIN_EMAIL, "password": "x", "name": "x"})
        assert r.status_code == 409

    def test_me_no_auth(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# ─── Cart & Checkout ───
class TestCartCheckout:
    def test_cart_add_get_remove(self, s, demo_token, products):
        h = {"Authorization": f"Bearer {demo_token}"}
        # clear first
        s.post(f"{API}/cart/clear", headers=h)
        pid = products[0]["id"]
        r = s.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 2, "variants": {"size": "M"}}, headers=h)
        assert r.status_code == 200
        item_id = r.json()["item_id"]
        # get
        r2 = s.get(f"{API}/cart", headers=h)
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert len(items) >= 1
        assert items[0]["product"]["id"] == pid
        # remove
        r3 = s.delete(f"{API}/cart/item/{item_id}", headers=h)
        assert r3.status_code == 200

    def test_checkout_cod(self, s, demo_token, products):
        h = {"Authorization": f"Bearer {demo_token}"}
        s.post(f"{API}/cart/clear", headers=h)
        pid = products[0]["id"]
        s.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1, "variants": {"size": "L"}}, headers=h)
        body = {
            "address": {"name": "Test", "phone": "9999999999", "line1": "1 Main", "city": "Mumbai", "state": "MH", "pincode": "400001"},
            "payment_method": "cod",
        }
        r = s.post(f"{API}/checkout", json=body, headers=h)
        assert r.status_code == 200, r.text
        order = r.json()
        assert "order_number" in order and order["order_number"].startswith("MC")
        assert order["payment_method"] == "cod"
        oid = order["id"]
        # verify in /orders
        r2 = s.get(f"{API}/orders", headers=h)
        assert r2.status_code == 200
        assert any(o["id"] == oid for o in r2.json())

    def test_checkout_razorpay_mock(self, s, demo_token, products):
        h = {"Authorization": f"Bearer {demo_token}"}
        s.post(f"{API}/cart/clear", headers=h)
        s.post(f"{API}/cart/add", json={"product_id": products[1]["id"], "quantity": 1}, headers=h)
        r = s.post(f"{API}/checkout", json={"address": {"name": "T"}, "payment_method": "razorpay"}, headers=h)
        assert r.status_code == 200
        assert "razorpay_order_id" in r.json()

    def test_checkout_empty_cart(self, s, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        s.post(f"{API}/cart/clear", headers=h)
        r = s.post(f"{API}/checkout", json={"address": {}, "payment_method": "cod"}, headers=h)
        assert r.status_code == 400


# ─── Reviews ───
class TestReviews:
    def test_list_reviews(self, s):
        r = s.get(f"{API}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Corporate RFQ ───
class TestRFQ:
    def test_submit_rfq(self, s):
        body = {
            "company": "TEST_Corp", "contact_name": "Tester", "email": "t@t.com",
            "phone": "9999999999", "products": "T-shirts", "quantity": 100,
            "delivery_location": "Mumbai", "notes": "test",
        }
        r = s.post(f"{API}/corporate/rfq", json=body)
        assert r.status_code == 200
        assert r.json()["company"] == "TEST_Corp"

    def test_list_rfqs_admin_only(self, s, admin_token):
        r = s.get(f"{API}/corporate/rfq", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_rfqs_unauth(self, s):
        r = s.get(f"{API}/corporate/rfq")
        assert r.status_code == 401


# ─── Settings & Admin ───
class TestAdmin:
    def test_get_settings_public(self, s):
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        assert "razorpay_enabled" in r.json()

    def test_update_settings_admin(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.put(f"{API}/settings", json={"razorpay_enabled": True, "seo": {"title": "Test SEO"}}, headers=h)
        assert r.status_code == 200
        assert r.json()["razorpay_enabled"] is True

    def test_update_settings_forbidden(self, s, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        r = s.put(f"{API}/settings", json={"razorpay_enabled": False}, headers=h)
        assert r.status_code == 403

    def test_admin_overview(self, s, admin_token):
        r = s.get(f"{API}/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        d = r.json()
        for k in ("total_orders", "revenue", "total_users", "total_products"):
            assert k in d

    def test_admin_orders_list(self, s, admin_token):
        r = s.get(f"{API}/admin/orders", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

    def test_admin_update_order_status(self, s, admin_token, demo_token, products):
        # create an order first
        hd = {"Authorization": f"Bearer {demo_token}"}
        s.post(f"{API}/cart/clear", headers=hd)
        s.post(f"{API}/cart/add", json={"product_id": products[0]["id"], "quantity": 1}, headers=hd)
        co = s.post(f"{API}/checkout", json={"address": {"name": "T"}, "payment_method": "cod"}, headers=hd).json()
        oid = co["id"]
        ha = {"Authorization": f"Bearer {admin_token}"}
        r = s.put(f"{API}/admin/orders/{oid}/status", json={"status": "processing"}, headers=ha)
        assert r.status_code == 200


# ─── AI ───
class TestAI:
    def test_enhance_prompt(self, s):
        r = s.post(f"{API}/ai/enhance-prompt", json={"prompt": "cat on skateboard"}, timeout=30)
        assert r.status_code == 200
        assert "enhanced" in r.json()

    @pytest.mark.timeout(90)
    def test_generate_image(self, s, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        r = s.post(f"{API}/ai/generate-image", json={"prompt": "minimal vector mountain logo", "style": "Minimalist"}, headers=h, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["image"].startswith("data:image/")
        assert "id" in d
