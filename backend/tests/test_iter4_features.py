"""Iteration 4 tests — 3-role system, bestsellers/trending, watching,
free-shipping threshold, CSV bulk import, color-specific variant images."""
import os
import io
import uuid
import pytest
import requests

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "superadmin@merchcraft.in", "password": "Super@123"}
ADMIN = {"email": "admin@merchcraft.in", "password": "Admin@123"}
DEMO = {"email": "demo@merchcraft.in", "password": "Demo@123"}


def login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"login failed: {r.text}"
    return r.json()["token"]


def ah(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def super_token(s):
    return login(s, SUPER)


@pytest.fixture(scope="session")
def admin_token(s):
    return login(s, ADMIN)


@pytest.fixture(scope="session")
def demo_token(s):
    return login(s, DEMO)


# ─── 3-role system ───
class TestRoles:
    def test_super_admin_can_list_admins(self, s, super_token):
        r = s.get(f"{API}/admin/admins", headers=ah(super_token))
        assert r.status_code == 200
        admins = r.json()
        roles = {a["role"] for a in admins}
        assert "superadmin" in roles
        assert "admin" in roles
        # ensure password hash not exposed
        for a in admins:
            assert "password_hash" not in a and "_id" not in a

    def test_regular_admin_forbidden_on_admins(self, s, admin_token):
        r = s.get(f"{API}/admin/admins", headers=ah(admin_token))
        assert r.status_code == 403

    def test_customer_forbidden_on_admins(self, s, demo_token):
        r = s.get(f"{API}/admin/admins", headers=ah(demo_token))
        assert r.status_code == 403

    def test_admin_users_returns_only_customers(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=ah(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert all(u["role"] == "customer" for u in users)


# ─── /admin/admins CRUD (superadmin only) ───
class TestAdminCRUD:
    def test_create_update_delete_admin(self, s, super_token):
        h = ah(super_token)
        email = f"test_admin_{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{API}/admin/admins",
                   json={"email": email, "password": "Test@1234", "name": "TEST Admin"},
                   headers=h)
        assert r.status_code == 200, r.text
        new_admin = r.json()
        assert new_admin["role"] == "admin"
        assert new_admin["email"] == email
        uid = new_admin["id"]

        # verify visible in GET
        admins = s.get(f"{API}/admin/admins", headers=h).json()
        assert any(a["id"] == uid for a in admins)

        # update name
        r2 = s.put(f"{API}/admin/admins/{uid}", json={"name": "TEST Updated"}, headers=h)
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST Updated"

        # delete
        r3 = s.delete(f"{API}/admin/admins/{uid}", headers=h)
        assert r3.status_code == 200

        # verify gone
        admins = s.get(f"{API}/admin/admins", headers=h).json()
        assert not any(a["id"] == uid for a in admins)

    def test_cannot_delete_superadmin(self, s, super_token):
        admins = s.get(f"{API}/admin/admins", headers=ah(super_token)).json()
        sa = next(a for a in admins if a["role"] == "superadmin")
        # delete self is blocked
        r = s.delete(f"{API}/admin/admins/{sa['id']}", headers=ah(super_token))
        assert r.status_code == 400

    def test_create_admin_forbidden_for_admin(self, s, admin_token):
        r = s.post(f"{API}/admin/admins",
                   json={"email": "x@y.com", "password": "x", "name": "X"},
                   headers=ah(admin_token))
        assert r.status_code == 403

    def test_create_duplicate_email(self, s, super_token):
        r = s.post(f"{API}/admin/admins",
                   json={"email": "admin@merchcraft.in", "password": "x", "name": "x"},
                   headers=ah(super_token))
        assert r.status_code == 409


# ─── Trending + Bestsellers ───
class TestTrendingBestsellers:
    def test_trending_returns_max_6(self, s):
        r = s.get(f"{API}/products/trending")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) <= 6
        # Sorted by sold_count desc
        sold = [i.get("sold_count", 0) for i in items]
        assert sold == sorted(sold, reverse=True)

    def test_bestsellers_returns_flagged_only(self, s):
        r = s.get(f"{API}/products/bestsellers")
        assert r.status_code == 200
        items = r.json()
        assert all(p["is_bestseller"] for p in items)

    def test_disabled_category_excluded(self, s, admin_token):
        h = ah(admin_token)
        # find a category with bestseller products
        cats = s.get(f"{API}/admin/categories", headers=h).json()
        # find category slug "t-shirts" which has bestsellers
        tshirts = next(c for c in cats if c["slug"] == "t-shirts")
        cid = tshirts["id"]
        # toggle to disabled
        s.patch(f"{API}/categories/{cid}/toggle", headers=h)
        try:
            bs = s.get(f"{API}/products/bestsellers").json()
            tr = s.get(f"{API}/products/trending").json()
            assert all(p["category"] != "t-shirts" for p in bs)
            assert all(p["category"] != "t-shirts" for p in tr)
        finally:
            # toggle back
            s.patch(f"{API}/categories/{cid}/toggle", headers=h)


# ─── Product flags PATCH and watching PUT ───
class TestProductFlags:
    def test_patch_flags(self, s, admin_token):
        products = s.get(f"{API}/products").json()
        pid = products[0]["id"]
        h = ah(admin_token)
        original = products[0].get("is_bestseller", False)
        r = s.patch(f"{API}/products/{pid}/flags",
                    json={"is_bestseller": not original}, headers=h)
        assert r.status_code == 200
        assert r.json()["is_bestseller"] == (not original)
        # toggle low_stock
        r2 = s.patch(f"{API}/products/{pid}/flags",
                     json={"low_stock": True}, headers=h)
        assert r2.status_code == 200
        assert r2.json()["low_stock"] is True
        # restore
        s.patch(f"{API}/products/{pid}/flags",
                json={"is_bestseller": original, "low_stock": False}, headers=h)

    def test_patch_flags_forbidden_customer(self, s, demo_token):
        products = s.get(f"{API}/products").json()
        r = s.patch(f"{API}/products/{products[0]['id']}/flags",
                    json={"is_bestseller": True}, headers=ah(demo_token))
        assert r.status_code == 403

    def test_set_watching_count(self, s, admin_token):
        products = s.get(f"{API}/products").json()
        pid = products[0]["id"]
        r = s.put(f"{API}/products/{pid}/watching",
                  json={"watching_count": 42}, headers=ah(admin_token))
        assert r.status_code == 200
        # verify persistence
        p = s.get(f"{API}/products/{pid}").json()
        assert p["watching_count"] == 42

    def test_watching_negative_rejected(self, s, admin_token):
        products = s.get(f"{API}/products").json()
        r = s.put(f"{API}/products/{products[0]['id']}/watching",
                  json={"watching_count": -5}, headers=ah(admin_token))
        assert r.status_code == 400


# ─── CSV Bulk Import ───
class TestBulkImport:
    def test_csv_import(self, s, admin_token):
        csv_content = (
            "name,category,base_price,is_bestseller,description\n"
            f"TEST_CSV_Tee_{uuid.uuid4().hex[:6]},t-shirts,299,true,Imported via CSV\n"
        )
        files = {"file": ("products.csv", csv_content, "text/csv")}
        r = s.post(f"{API}/products/bulk-import", files=files, headers=ah(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 1
        assert data["errors"] == []

    def test_csv_invalid_rows(self, s, admin_token):
        csv_content = (
            "name,category,base_price\n"
            ",t-shirts,100\n"
            "TEST_NoPrice,t-shirts,\n"
        )
        files = {"file": ("bad.csv", csv_content, "text/csv")}
        r = s.post(f"{API}/products/bulk-import", files=files, headers=ah(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert d["created"] == 0
        assert len(d["errors"]) >= 2

    def test_csv_import_forbidden(self, s, demo_token):
        files = {"file": ("p.csv", "name,category,base_price\nx,y,1\n", "text/csv")}
        r = s.post(f"{API}/products/bulk-import", files=files, headers=ah(demo_token))
        assert r.status_code == 403


# ─── Free Shipping Threshold + COD toggle ───
class TestSettings:
    def test_threshold_persists(self, s, admin_token):
        h = ah(admin_token)
        original = s.get(f"{API}/settings").json().get("free_shipping_threshold", 999)
        r = s.put(f"{API}/settings", json={"free_shipping_threshold": 1500}, headers=h)
        assert r.status_code == 200
        assert r.json()["free_shipping_threshold"] == 1500
        # verify via public GET
        assert s.get(f"{API}/settings").json()["free_shipping_threshold"] == 1500
        # restore
        s.put(f"{API}/settings", json={"free_shipping_threshold": original}, headers=h)

    def test_cod_disabled_blocks_checkout(self, s, admin_token, demo_token):
        h_admin = ah(admin_token)
        h_demo = ah(demo_token)
        s.put(f"{API}/settings", json={"cod_enabled": False}, headers=h_admin)
        try:
            products = s.get(f"{API}/products").json()
            s.post(f"{API}/cart/clear", headers=h_demo)
            s.post(f"{API}/cart/add", json={"product_id": products[0]["id"], "quantity": 1}, headers=h_demo)
            r = s.post(f"{API}/checkout",
                       json={"address": {"name": "T", "phone": "9", "line1": "x", "city": "x", "state": "x", "pincode": "1"},
                             "payment_method": "cod"},
                       headers=h_demo)
            assert r.status_code == 400
        finally:
            s.put(f"{API}/settings", json={"cod_enabled": True}, headers=h_admin)


# ─── Variant Images (color-specific) ───
class TestVariantImages:
    def test_classic_tee_has_color_images(self, s):
        products = s.get(f"{API}/products?category=t-shirts").json()
        tee = next((p for p in products if p["name"] == "Classic Cotton Tee"), None)
        assert tee is not None
        vi = tee.get("variant_images", {})
        assert "color" in vi
        assert "Black" in vi["color"] and "White" in vi["color"] and "Navy" in vi["color"]

    def test_create_with_variant_images(self, s, admin_token):
        h = ah(admin_token)
        payload = {
            "name": f"TEST_ColorTee_{uuid.uuid4().hex[:6]}",
            "category": "t-shirts",
            "description": "test",
            "base_price": 599,
            "image": "https://x.com/default.jpg",
            "variants": {"size": ["S"], "color": ["Red", "Blue"]},
            "variant_images": {"color": {"Red": "https://x.com/red.jpg", "Blue": "https://x.com/blue.jpg"}},
            "tags": [], "is_active": True, "is_bestseller": True,
            "low_stock": False, "watching_count": 12,
        }
        r = s.post(f"{API}/products", json=payload, headers=h)
        assert r.status_code == 200
        pid = r.json()["id"]
        got = s.get(f"{API}/products/{pid}").json()
        assert got["variant_images"]["color"]["Red"] == "https://x.com/red.jpg"
        assert got["is_bestseller"] is True
        assert got["watching_count"] == 12
        s.delete(f"{API}/products/{pid}", headers=h)


# ─── Shipping in checkout ───
class TestShipping:
    def test_free_shipping_applied_above_threshold(self, s, admin_token, demo_token):
        h_admin = ah(admin_token)
        h_demo = ah(demo_token)
        # set threshold to 500
        s.put(f"{API}/settings", json={"free_shipping_threshold": 500}, headers=h_admin)
        try:
            # pick a product over ₹500
            products = s.get(f"{API}/products").json()
            expensive = next(p for p in products if p["base_price"] >= 600)
            s.post(f"{API}/cart/clear", headers=h_demo)
            s.post(f"{API}/cart/add", json={"product_id": expensive["id"], "quantity": 1}, headers=h_demo)
            order = s.post(f"{API}/checkout",
                           json={"address": {"name": "T", "phone": "9", "line1": "x", "city": "x", "state": "x", "pincode": "1"},
                                 "payment_method": "cod"},
                           headers=h_demo).json()
            assert order["shipping_cost"] == 0

            # below threshold
            s.put(f"{API}/settings", json={"free_shipping_threshold": 100000}, headers=h_admin)
            cheap = next(p for p in products if p["base_price"] < 500)
            s.post(f"{API}/cart/clear", headers=h_demo)
            s.post(f"{API}/cart/add", json={"product_id": cheap["id"], "quantity": 1}, headers=h_demo)
            order2 = s.post(f"{API}/checkout",
                            json={"address": {"name": "T", "phone": "9", "line1": "x", "city": "x", "state": "x", "pincode": "1"},
                                  "payment_method": "cod"},
                            headers=h_demo).json()
            assert order2["shipping_cost"] == 49
        finally:
            s.put(f"{API}/settings", json={"free_shipping_threshold": 999}, headers=h_admin)
