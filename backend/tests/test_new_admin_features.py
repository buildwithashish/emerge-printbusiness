"""Iteration 3 tests — new admin CRUD endpoints + cart qty update."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://design-to-product-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@merchcraft.in", "password": "Admin@123"}
DEMO = {"email": "demo@merchcraft.in", "password": "Demo@123"}


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_id(s, admin_token):
    r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    return r.json()["id"]


@pytest.fixture(scope="session")
def demo_token(s):
    r = s.post(f"{API}/auth/login", json=DEMO)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def products(s):
    return s.get(f"{API}/products").json()


def ah(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Cart qty update (PUT /cart/item/{id}) ───
class TestCartQtyUpdate:
    def test_update_qty(self, s, demo_token, products):
        h = ah(demo_token)
        s.post(f"{API}/cart/clear", headers=h)
        pid = products[0]["id"]
        r = s.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1}, headers=h)
        item_id = r.json()["item_id"]
        # update to 5
        r2 = s.put(f"{API}/cart/item/{item_id}", json={"quantity": 5}, headers=h)
        assert r2.status_code == 200
        # verify GET
        cart = s.get(f"{API}/cart", headers=h).json()
        match = [i for i in cart["items"] if i["id"] == item_id]
        assert len(match) == 1
        assert match[0]["quantity"] == 5

    def test_qty_zero_rejected(self, s, demo_token, products):
        h = ah(demo_token)
        s.post(f"{API}/cart/clear", headers=h)
        r = s.post(f"{API}/cart/add", json={"product_id": products[0]["id"], "quantity": 1}, headers=h)
        item_id = r.json()["item_id"]
        r2 = s.put(f"{API}/cart/item/{item_id}", json={"quantity": 0}, headers=h)
        assert r2.status_code == 400

    def test_unauth(self, s):
        r = s.put(f"{API}/cart/item/x", json={"quantity": 2})
        assert r.status_code == 401


# ─── Category CRUD ───
class TestCategoryCRUD:
    def test_full_lifecycle(self, s, admin_token):
        h = ah(admin_token)
        slug = f"test-cat-{uuid.uuid4().hex[:6]}"
        # CREATE
        r = s.post(f"{API}/categories", json={"name": "TEST Category", "slug": slug, "image": "https://x.com/i.jpg", "is_active": True}, headers=h)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["slug"] == slug
        # admin list (includes inactive)
        admin_cats = s.get(f"{API}/admin/categories", headers=h).json()
        assert any(c["id"] == cid for c in admin_cats)
        # UPDATE
        r2 = s.put(f"{API}/categories/{cid}", json={"name": "TEST Updated", "slug": slug, "image": "https://x.com/y.jpg", "is_active": True}, headers=h)
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST Updated"
        # TOGGLE
        r3 = s.patch(f"{API}/categories/{cid}/toggle", headers=h)
        assert r3.status_code == 200
        assert r3.json()["is_active"] is False
        # DELETE
        r4 = s.delete(f"{API}/categories/{cid}", headers=h)
        assert r4.status_code == 200
        # verify gone
        admin_cats = s.get(f"{API}/admin/categories", headers=h).json()
        assert not any(c["id"] == cid for c in admin_cats)

    def test_admin_only(self, s, demo_token):
        h = ah(demo_token)
        r = s.post(f"{API}/categories", json={"name": "x", "slug": "x", "image": "", "is_active": True}, headers=h)
        assert r.status_code == 403
        r2 = s.get(f"{API}/admin/categories", headers=h)
        assert r2.status_code == 403

    def test_toggle_404(self, s, admin_token):
        r = s.patch(f"{API}/categories/nonexistent/toggle", headers=ah(admin_token))
        assert r.status_code == 404


# ─── Admin Users ───
class TestAdminUsers:
    def test_list_users(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=ah(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 2
        for u in users:
            assert "password_hash" not in u
            assert "order_count" in u
            assert "_id" not in u

    def test_users_forbidden_for_customer(self, s, demo_token):
        r = s.get(f"{API}/admin/users", headers=ah(demo_token))
        assert r.status_code == 403

    def test_update_role_and_delete(self, s, admin_token):
        # Create a fresh user to update/delete
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass@123", "name": "TEST Role User"})
        uid = reg.json()["user"]["id"]
        h = ah(admin_token)
        # change role to admin
        r = s.put(f"{API}/admin/users/{uid}", json={"role": "admin"}, headers=h)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        # invalid role
        r2 = s.put(f"{API}/admin/users/{uid}", json={"role": "superuser"}, headers=h)
        assert r2.status_code == 400
        # delete
        r3 = s.delete(f"{API}/admin/users/{uid}", headers=h)
        assert r3.status_code == 200

    def test_cannot_delete_self(self, s, admin_token, admin_id):
        r = s.delete(f"{API}/admin/users/{admin_id}", headers=ah(admin_token))
        assert r.status_code == 400


# ─── Admin Order Detail ───
class TestAdminOrderDetail:
    def test_get_order_detail(self, s, admin_token, demo_token, products):
        # create an order
        hd = ah(demo_token)
        s.post(f"{API}/cart/clear", headers=hd)
        s.post(f"{API}/cart/add", json={"product_id": products[0]["id"], "quantity": 2}, headers=hd)
        co = s.post(f"{API}/checkout", json={"address": {"name": "T", "phone": "9", "line1": "x", "city": "x", "state": "x", "pincode": "1"}, "payment_method": "cod"}, headers=hd).json()
        oid = co["id"]
        # admin GET detail
        r = s.get(f"{API}/admin/orders/{oid}", headers=ah(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == oid
        assert "_id" not in d
        assert "items" in d
        assert "total" in d

    def test_admin_order_detail_404(self, s, admin_token):
        r = s.get(f"{API}/admin/orders/nonexistent", headers=ah(admin_token))
        assert r.status_code == 404
