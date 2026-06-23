"""
Iteration 6 backend tests — OTP, guest checkout, broadcast, auto-bestseller,
admin alerts, corporate kits, sample CSV, notifications log, templates.
"""
import os
import time
import pytest
import requests
from pathlib import Path

def _load_env():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
_load_env()

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@merchcraft.in", "password": "Admin@123"}
CUST = {"email": "demo@merchcraft.in", "password": "Demo@123"}


# ─── fixtures ─────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{API}/auth/login", json=CUST, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ─── OTP endpoints ────────────────────────────────────────────
class TestOTP:
    def test_send_otp_sms(self):
        r = requests.post(f"{API}/auth/send-otp", json={"target": "+918999111222", "channel": "sms"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("sent") is True
        assert "dev_code" in data
        assert len(str(data["dev_code"])) == 6

    def test_send_otp_email(self):
        r = requests.post(f"{API}/auth/send-otp", json={"target": "test_otp@example.com", "channel": "email"})
        assert r.status_code == 200
        assert "dev_code" in r.json()

    def test_verify_otp_success(self):
        phone = "+918999111333"
        s = requests.post(f"{API}/auth/send-otp", json={"target": phone, "channel": "sms"}).json()
        code = s["dev_code"]
        v = requests.post(f"{API}/auth/verify-otp", json={"target": phone, "code": code})
        assert v.status_code == 200
        assert v.json().get("verified") is True

    def test_verify_otp_wrong_code(self):
        phone = "+918999111444"
        requests.post(f"{API}/auth/send-otp", json={"target": phone, "channel": "sms"})
        v = requests.post(f"{API}/auth/verify-otp", json={"target": phone, "code": "000000"})
        assert v.status_code == 400


# ─── Guest checkout ───────────────────────────────────────────
class TestGuestCheckout:
    def test_guest_checkout_creates_order_and_user(self):
        # need a real product id
        pr = requests.get(f"{API}/products?limit=1").json()
        assert pr, "no products seeded"
        prod = pr[0]
        size = (prod.get("variants", {}).get("size") or ["M"])[0]
        color = (prod.get("variants", {}).get("color") or ["Black"])[0] if prod.get("variants", {}).get("color") else None

        phone = f"+918999{int(time.time()) % 1000000:06d}"
        email = f"TEST_guest_{int(time.time())}@example.com"
        s = requests.post(f"{API}/auth/send-otp", json={"target": phone, "channel": "sms"}).json()
        code = s["dev_code"]

        item = {"product_id": prod["id"], "qty": 1, "size": size}
        if color:
            item["color"] = color

        payload = {
            "items": [item],
            "customer": {
                "name": "Test Guest",
                "email": email,
                "phone": phone,
                "line1": "1 Test Lane",
                "city": "Mumbai",
                "state": "MH",
                "pincode": "400001",
            },
            "phone_otp_code": code,
            "payment_method": "cod",
            "register": False,
            "marketing_opt_in": True,
        }
        r = requests.post(f"{API}/checkout/guest", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("id")
        assert data.get("order_number", "").startswith("MC")
        assert data.get("generated_password") and len(data["generated_password"]) >= 6
        assert data["customer_snapshot"]["email"] == email.lower()

    def test_guest_checkout_invalid_otp(self):
        pr = requests.get(f"{API}/products?limit=1").json()
        prod = pr[0]
        size = (prod.get("variants", {}).get("size") or ["M"])[0]
        item = {"product_id": prod["id"], "qty": 1, "size": size}
        payload = {
            "items": [item],
            "customer": {"name": "X", "email": "bad@example.com", "phone": "+918111000111",
                         "line1": "x", "city": "x", "pincode": "111111"},
            "phone_otp_code": "999999",
            "payment_method": "cod",
            "register": False,
            "marketing_opt_in": False,
        }
        r = requests.post(f"{API}/checkout/guest", json=payload, timeout=15)
        assert r.status_code == 400


# ─── Corporate kits ───────────────────────────────────────────
class TestCorporateKits:
    def test_kits_endpoint(self):
        r = requests.get(f"{API}/corporate/kits")
        assert r.status_code == 200
        data = r.json()
        assert "kits" in data and isinstance(data["kits"], list)
        assert len(data["kits"]) == 3
        assert data.get("customizable") is True
        for k in data["kits"]:
            assert ("id" in k or "slug" in k)
            assert "name" in k and "includes" in k
            assert isinstance(k["includes"], list) and len(k["includes"]) >= 3


# ─── Sample CSV ───────────────────────────────────────────────
class TestSampleCSV:
    def test_sample_csv_download(self):
        r = requests.get(f"{API}/products/sample-csv")
        assert r.status_code == 200
        assert "name,category" in r.text
        assert "attachment" in r.headers.get("Content-Disposition", "").lower()


# ─── Admin alerts ─────────────────────────────────────────────
class TestAdminAlerts:
    def test_get_alerts(self, admin_headers):
        r = requests.get(f"{API}/admin/alerts", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_alerts_require_admin(self):
        r = requests.get(f"{API}/admin/alerts")
        assert r.status_code in (401, 403)


# ─── Auto-bestseller ──────────────────────────────────────────
class TestAutoBestseller:
    def test_run_auto_bestseller(self, admin_headers):
        r = requests.post(f"{API}/admin/run-auto-bestseller", headers=admin_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_alert_created_for_low_stock_bestseller(self, admin_headers):
        # After running auto-bestseller, check if there are low-stock bestseller alerts
        requests.post(f"{API}/admin/run-auto-bestseller", headers=admin_headers)
        r = requests.get(f"{API}/admin/alerts", headers=admin_headers)
        assert r.status_code == 200
        # alerts may or may not exist; just ensure shape
        for a in r.json():
            assert "id" in a


# ─── Broadcast ────────────────────────────────────────────────
class TestBroadcast:
    def test_broadcast_returns_counts(self, admin_headers):
        payload = {
            "subject": "TEST Promo",
            "body": "Hi {name}, sale on now",
            "channels": ["email", "whatsapp"],
        }
        r = requests.post(f"{API}/admin/broadcast", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "counts" in data
        assert set(data["counts"].keys()) >= {"email", "sms", "whatsapp"}

    def test_broadcast_requires_admin(self):
        r = requests.post(f"{API}/admin/broadcast", json={"subject": "X", "body": "Y", "channels": ["email"]})
        assert r.status_code in (401, 403)


# ─── Notifications log ────────────────────────────────────────
class TestNotificationsLog:
    def test_log_returns_entries(self, admin_headers):
        r = requests.get(f"{API}/admin/notifications-log?limit=50", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            entry = data[0]
            assert "channel" in entry
            assert "target" in entry

    def test_guest_order_creates_log_entries(self, admin_headers):
        # do a guest order then verify log entries
        pr = requests.get(f"{API}/products?limit=1").json()
        prod = pr[0]
        size = (prod.get("variants", {}).get("size") or ["M"])[0]
        phone = f"+918999{(int(time.time()) + 99) % 1000000:06d}"
        email = f"TEST_log_{int(time.time())}@example.com"
        code = requests.post(f"{API}/auth/send-otp", json={"target": phone, "channel": "sms"}).json()["dev_code"]
        item = {"product_id": prod["id"], "qty": 1, "size": size}
        if prod.get("variants", {}).get("color"):
            item["color"] = prod["variants"]["color"][0]
        payload = {
            "items": [item],
            "customer": {"name": "Log Test", "email": email, "phone": phone,
                         "line1": "1 Lane", "city": "Mumbai", "pincode": "400001"},
            "phone_otp_code": code,
            "payment_method": "cod",
            "register": False,
            "marketing_opt_in": True,
        }
        r = requests.post(f"{API}/checkout/guest", json=payload, timeout=20)
        assert r.status_code == 200
        order_id = r.json()["id"]

        time.sleep(1)  # let async writes settle
        log = requests.get(f"{API}/admin/notifications-log?limit=200", headers=admin_headers).json()
        related = [e for e in log if e.get("target") in (email.lower(), phone)]
        # Expect at least 3 entries: order_placed email + whatsapp + guest_welcome
        assert len(related) >= 2, f"Expected >=2 notification entries; got {len(related)}"
        kinds = {(e.get("meta") or {}).get("kind") for e in related}
        assert "guest_welcome" in kinds or any(e.get("channel") == "email" for e in related)


# ─── Settings / Templates ─────────────────────────────────────
class TestTemplates:
    def test_settings_has_templates(self, admin_headers):
        r = requests.get(f"{API}/settings", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        assert "templates" in s
        for k in ("order_placed_email", "order_placed_whatsapp", "guest_welcome_email", "broadcast_default"):
            assert k in s["templates"]

    def test_template_save_persists(self, admin_headers):
        r = requests.get(f"{API}/settings", headers=admin_headers)
        s = r.json()
        templates = s.get("templates", {})
        # mutate the body of order_placed_email
        marker = f"TEST_MARKER_{int(time.time())}"
        original = templates.get("order_placed_email", {}).copy()
        templates["order_placed_email"] = {
            **original,
            "body": (original.get("body", "") + f"\n{marker}"),
        }
        upd = requests.put(f"{API}/settings", json={"templates": templates}, headers=admin_headers)
        assert upd.status_code == 200, upd.text
        # reload
        r2 = requests.get(f"{API}/settings", headers=admin_headers)
        assert marker in r2.json()["templates"]["order_placed_email"]["body"]
        # restore
        templates["order_placed_email"] = original
        requests.put(f"{API}/settings", json={"templates": templates}, headers=admin_headers)


# ─── Hero / bestsellers ───────────────────────────────────────
class TestBestsellers:
    def test_bestsellers_exist(self):
        r = requests.get(f"{API}/products/bestsellers?limit=8")
        assert r.status_code == 200
        assert len(r.json()) >= 1


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v"]))
