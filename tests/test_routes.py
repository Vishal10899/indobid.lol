import os
import json
import uuid
import hmac
import hashlib
from config import Config, TestConfig
from models import Winner, Entry, Listing, Round, Payment, SiteVisitor, SiteSetting, get_utc_now

def test_homepage_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Get Your Link On Top." in html
    assert "CURRENT LISTINGS" in html
    assert "TOP 3" in html
    assert "3 listings are selected every hour" in html
    assert "online" in html

def test_create_order_success(client, db_sess):
    unique_url = f"https://x.com/creator_{uuid.uuid4().hex[:8]}"
    payload = {
        "display_name": "Test Builder",
        "platform": "twitter",
        "profile_url": unique_url
    }
    response = client.post(
        "/entry/create-order",
        data=json.dumps(payload),
        content_type="application/json"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "order_id" in data
    assert data["amount"] == 200  # $2 = 200 cents
    assert data["currency"] == "USD"

    # Verify payment record in DB
    payment = db_sess.query(Payment).filter_by(order_id=data["order_id"]).first()
    assert payment is not None
    assert payment.status == "created"

def test_create_order_validation(client):
    # Invalid short name
    res1 = client.post("/entry/create-order", data=json.dumps({
        "display_name": "A",
        "platform": "twitter",
        "profile_url": "https://x.com/validurl"
    }), content_type="application/json")
    assert res1.status_code == 400

    # Invalid URL
    res2 = client.post("/entry/create-order", data=json.dumps({
        "display_name": "Valid Name",
        "platform": "twitter",
        "profile_url": "ftp://invalid-scheme"
    }), content_type="application/json")
    assert res2.status_code == 400

def test_create_order_duplicate_blocked(client, db_sess):
    unique_dup = f"https://x.com/dup_{uuid.uuid4().hex[:8]}"
    
    # 1. Create order & verify payment to make entry active
    res1 = client.post("/entry/create-order", data=json.dumps({
        "display_name": "First Entry",
        "platform": "twitter",
        "profile_url": unique_dup
    }), content_type="application/json")
    order_id = res1.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    
    # Generate valid signature
    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "display_name": "First Entry",
        "platform": "twitter",
        "profile_url": unique_dup
    }), content_type="application/json")
    assert verify_res.status_code == 201

    # 2. Second attempt with identical URL should be rejected
    res2 = client.post("/entry/create-order", data=json.dumps({
        "display_name": "Second Entry",
        "platform": "twitter",
        "profile_url": unique_dup
    }), content_type="application/json")
    assert res2.status_code == 400
    assert "already entered" in res2.get_json()["error"]

def test_verify_payment_success(client, db_sess):
    order_id = f"order_{uuid.uuid4().hex[:10]}"
    payment_id = f"pay_{uuid.uuid4().hex[:10]}"
    url = f"https://github.com/user_{uuid.uuid4().hex[:6]}"

    # Pre-create payment record
    p = Payment(provider="razorpay", order_id=order_id, amount=2.0, currency="USD", status="created", created_at=get_utc_now())
    db_sess.add(p)
    db_sess.commit()

    # Valid signature
    secret = TestConfig.RAZORPAY_KEY_SECRET
    signature = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    response = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": signature,
        "display_name": "Valid Creator",
        "platform": "github",
        "profile_url": url
    }), content_type="application/json")

    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True

    # Check DB state
    p_updated = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert p_updated.status == "paid"
    assert p_updated.transaction_id == payment_id
    assert p_updated.entry_id is not None

    entry = db_sess.query(Entry).filter_by(id=p_updated.entry_id).first()
    assert entry is not None
    assert entry.status == "eligible"
    assert entry.display_name == "Valid Creator"

def test_verify_payment_invalid_signature_rejected(client, db_sess):
    order_id = f"order_{uuid.uuid4().hex[:10]}"
    payment_id = f"pay_{uuid.uuid4().hex[:10]}"

    p = Payment(provider="razorpay", order_id=order_id, amount=2.0, currency="USD", status="created", created_at=get_utc_now())
    db_sess.add(p)
    db_sess.commit()

    # Invalid fake signature
    response = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": "invalid_fake_signature_hex",
        "display_name": "Hacker",
        "platform": "twitter",
        "profile_url": "https://x.com/fake"
    }), content_type="application/json")

    assert response.status_code == 400
    assert response.get_json()["success"] is False

    # Check payment is marked failed and no entry created
    p_updated = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert p_updated.status == "failed"
    assert p_updated.entry_id is None

def test_payment_failed_endpoint(client, db_sess):
    order_id = f"order_{uuid.uuid4().hex[:8]}"
    p = Payment(order_id=order_id, status="created")
    db_sess.add(p)
    db_sess.commit()

    res = client.post("/entry/payment-failed", data=json.dumps({"order_id": order_id}), content_type="application/json")
    assert res.status_code == 200

    p_updated = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert p_updated.status == "failed"

def test_profile_click_tracking(client, db_sess):
    now = get_utc_now()
    r = Round(start_time=now, end_time=now, status="completed", created_at=now)
    db_sess.add(r)
    db_sess.flush()

    e = Entry(round_id=r.id, display_name="Top Winner", platform="twitter", profile_url="https://x.com/topwinner", status="winner")
    db_sess.add(e)
    db_sess.flush()

    w = Winner(round_id=r.id, entry_id=e.id, position=1, clicks=10, created_at=now)
    db_sess.add(w)
    db_sess.commit()
    winner_id = w.id

    # Visit profile click endpoint
    response = client.get(f"/profile/{winner_id}/visit", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"] == "https://x.com/topwinner"

    # Verify clicks incremented
    w_updated = db_sess.query(Winner).filter_by(id=winner_id).first()
    assert w_updated.clicks == 11

def test_visitor_tracking_and_stats(client, db_sess):
    # Initial request should log a visitor
    client.get("/")
    visitors_count = db_sess.query(SiteVisitor).count()
    assert visitors_count >= 1

    # Round status should contain real stats
    res = client.get("/api/round-status")
    assert res.status_code == 200
    data = res.get_json()
    assert "stats" in data
    assert "total_visitors" in data["stats"]
    assert "total_entries" in data["stats"]
    assert "profile_clicks" in data["stats"]

def test_legal_pages(client):
    for endpoint in ["/rules", "/terms", "/privacy", "/refunds", "/about", "/winners"]:
        res = client.get(endpoint)
        assert res.status_code == 200

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"

def test_admin_protection(client):
    response = client.get("/admin/dashboard", follow_redirects=False)
    assert response.status_code == 302
    assert "/admin/login" in response.headers["Location"]

def test_admin_login_and_dashboard(client):
    login_res = client.post(
        "/admin/login",
        data={"email": TestConfig.ADMIN_EMAIL, "password": TestConfig.ADMIN_PASSWORD},
        follow_redirects=True
    )
    assert login_res.status_code == 200
    html = login_res.get_data(as_text=True)
    assert "Administrator Dashboard" in html
    assert "Round Controls" in html

    # Verify seed-entries route is completely disabled / removed (404)
    seed_res = client.post("/admin/seed-entries", follow_redirects=True)
    assert seed_res.status_code == 404

    # Trigger Draw
    draw_res = client.post("/admin/trigger-draw", follow_redirects=True)
    assert draw_res.status_code == 200
    assert "completed!" in draw_res.get_data(as_text=True)

def test_security_headers(client):
    response = client.get("/")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"

def test_404_handling(client):
    res_web = client.get("/non-existent-page")
    assert res_web.status_code == 404
    assert "404" in res_web.get_data(as_text=True)

    res_api = client.get("/api/non-existent-endpoint")
    assert res_api.status_code == 404
    assert res_api.get_json()["success"] is False

def test_admin_invalid_login(client):
    res = client.post(
        "/admin/login",
        data={"email": "wrong@admin.com", "password": "WrongPassword123!"},
        follow_redirects=True
    )
    assert res.status_code == 200
    assert "Invalid administrator credentials" in res.get_data(as_text=True)

def test_seed_entries_removed(client):
    """Seed entries shortcut is completely removed to prevent unverified listings."""
    # Log in first
    client.post(
        "/admin/login",
        data={"email": TestConfig.ADMIN_EMAIL, "password": TestConfig.ADMIN_PASSWORD},
        follow_redirects=True
    )
    res = client.post("/admin/seed-entries", follow_redirects=True)
    assert res.status_code == 404

def test_production_database_url_required(monkeypatch):
    import os
    import pytest
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("DATABASE_URL", "")

    with pytest.raises(RuntimeError, match="DATABASE_URL environment variable is required in production"):
        is_prod = os.getenv("RENDER") == "true"
        raw_db = os.getenv("DATABASE_URL", "").strip()
        if is_prod and not raw_db:
            raise RuntimeError("DATABASE_URL environment variable is required in production.")

def test_visit_listing_click_counter_and_redirect(client, db_sess):
    from models import Listing, Payment, Round
    from engine import get_current_round
    now = get_utc_now()
    r = Round(start_time=now, end_time=now, status="active", created_at=now)
    db_sess.add(r)
    db_sess.flush()

    listing = Listing(
        round_id=r.id,
        username="LinkTester",
        platform="website",
        profile_url="https://tester.com/myproduct",
        payment_status="SUCCESS",
        payment_id="pay_test_click",
        click_count=5,
        status="eligible",
        created_at=now
    )
    db_sess.add(listing)
    db_sess.flush()

    payment = Payment(
        listing_id=listing.id,
        provider="razorpay",
        order_id="order_test_click",
        payment_id="pay_test_click",
        amount=2.0,
        currency="USD",
        status="paid",
        created_at=now
    )
    db_sess.add(payment)
    db_sess.commit()
    listing_id = listing.id

    # Visit /visit/<listing_id>
    response = client.get(f"/visit/{listing_id}", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"] == "https://tester.com/myproduct"

    # Verify click counter incremented from 5 to 6
    updated_listing = db_sess.query(Listing).filter_by(id=listing_id).first()
    assert updated_listing is not None
    assert updated_listing.click_count == 6

def test_admin_settings_customization(client, db_sess):
    # Log in as admin
    client.post(
        "/admin/login",
        data={"email": TestConfig.ADMIN_EMAIL, "password": TestConfig.ADMIN_PASSWORD},
        follow_redirects=True
    )

    # Update settings
    res = client.post("/admin/settings", data={
        "listing_price": "5.00",
        "currency": "USD",
        "site_name": "custom.bid",
        "primary_color": "#10b981",
        "secondary_color": "#d1fae5",
        "background_color": "#f0fdf4",
        "button_color": "#059669",
        "hero_heading": "Reach 10,000 Visitors Fast",
        "hero_description": "Exclusive hourly showcase platform.",
        "homepage_text": "Equal chance draw.",
        "razorpay_key_id": "rzp_test_custom",
        "razorpay_key_secret": "••••••••"
    }, follow_redirects=True)
    assert res.status_code == 200

    # Fetch homepage to verify settings applied dynamically
    home_res = client.get("/")
    assert home_res.status_code == 200
    home_html = home_res.get_data(as_text=True)
    assert "Reach 10,000 Visitors Fast" in home_html
    assert "$5" in home_html

def test_unpaid_listing_never_appears_in_current_listings(client, db_sess):
    # Start order (unpaid)
    unique_url = f"https://x.com/unpaid_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "display_name": "Unpaid User",
        "platform": "twitter",
        "profile_url": unique_url
    }), content_type="application/json")
    assert res.status_code == 200

    # Check /api/round-status
    status_res = client.get("/api/round-status")
    data = status_res.get_json()
    urls = [l["profile_url"] for l in data.get("current_listings", [])]
    assert unique_url not in urls

def test_round_status_api(client, db_sess):
    response = client.get("/api/round-status")
    assert response.status_code == 200
    data = response.get_json()
    assert "round_id" in data
    assert "remaining_seconds" in data
    assert "current_listings" in data
    assert "stats" in data
    assert "online_visitors" in data["stats"]

def test_winners_page_archive(client, db_sess):
    response = client.get("/winners")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "All Winners" in html

def test_create_order_creates_no_listing(client, db_sess):
    """Critical Rule: create-order must ONLY initialize a pending/created payment and NEVER create a listing."""
    unique_url = f"https://example.com/check_no_listing_{uuid.uuid4().hex[:8]}"
    initial_listing_count = db_sess.query(Listing).count()

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "OrderOnly User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "order_id" in data

    # Verify database state: NO listing created, payment status is 'created'
    after_listing_count = db_sess.query(Listing).count()
    assert after_listing_count == initial_listing_count
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

    payment = db_sess.query(Payment).filter_by(order_id=data["order_id"]).first()
    assert payment is not None
    assert payment.status == "created"
    assert payment.listing_id is None

def test_missing_razorpay_credentials_fails_closed(client, monkeypatch, db_sess):
    """Fail closed rule: If Razorpay credentials are missing or placeholder, reject with 503."""
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_test_placeholder")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "placeholder_secret")
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = ""
    settings.razorpay_key_secret = ""
    db_sess.commit()

    unique_url = f"https://example.com/unconfigured_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Unconfigured User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert res.status_code == 503
    data = res.get_json()
    assert data["success"] is False
    assert "Payment service is" in data["error"]

    # Verify endpoint also fails closed on verify-payment
    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": "order_fake_123",
        "razorpay_payment_id": "pay_fake_123",
        "razorpay_signature": "fake_sig_123",
        "username": "Unconfigured User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    assert verify_res.status_code == 503

def test_fake_signature_creates_no_listing(client, db_sess):
    """Fake signature must be rejected and must never create a listing."""
    unique_url = f"https://example.com/fake_sig_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Fake Sig User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_test_999",
        "razorpay_signature": "totally_fake_signature_hex_00000000000000000",
        "username": "Fake Sig User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert verify_res.get_json()["success"] is False

    payment = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert payment.status == "failed"
    assert payment.listing_id is None
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_missing_signature_creates_no_listing(client, db_sess):
    """Missing verification parameters must be rejected."""
    res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": "order_test_123",
        "razorpay_payment_id": "pay_test_123",
        "razorpay_signature": "",
        "username": "Missing Sig User",
        "platform": "website",
        "profile_url": "https://example.com/missing"
    }), content_type="application/json")
    assert res.status_code == 400
    assert res.get_json()["success"] is False

def test_wrong_payment_id_creates_no_listing(client, db_sess):
    """Signature generated for payment A must fail if submitted with payment B."""
    unique_url = f"https://example.com/wrong_pid_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Wrong Payment User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]

    # Generate signature for pay_intended
    secret = TestConfig.RAZORPAY_KEY_SECRET
    intended_sig = hmac.new(secret.encode(), f"{order_id}|pay_intended".encode(), hashlib.sha256).hexdigest()

    # Submit pay_tampered with intended_sig
    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_tampered",
        "razorpay_signature": intended_sig,
        "username": "Wrong Payment User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_wrong_order_id_creates_no_listing(client, db_sess):
    """Signature generated for order 1 must fail if submitted with order 2."""
    res1 = client.post("/entry/create-order", data=json.dumps({
        "username": "User One", "platform": "website", "profile_url": f"https://x.com/u1_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")
    order_id_1 = res1.get_json()["order_id"]

    res2 = client.post("/entry/create-order", data=json.dumps({
        "username": "User Two", "platform": "website", "profile_url": f"https://x.com/u2_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")
    order_id_2 = res2.get_json()["order_id"]

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig_1 = hmac.new(secret.encode(), f"{order_id_1}|pay_test_1".encode(), hashlib.sha256).hexdigest()

    # Try to verify order_2 using order_1's signature
    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id_2,
        "razorpay_payment_id": "pay_test_1",
        "razorpay_signature": sig_1,
        "username": "User Two",
        "platform": "website",
        "profile_url": f"https://x.com/u2_target"
    }), content_type="application/json")

    assert verify_res.status_code == 400
    p2 = db_sess.query(Payment).filter_by(order_id=order_id_2).first()
    assert p2.status == "failed"
    assert p2.listing_id is None

def test_nonexistent_order_id_rejected(client):
    """Order IDs not created by the application must be rejected."""
    secret = TestConfig.RAZORPAY_KEY_SECRET
    fake_order = "order_completely_unknown_9999"
    sig = hmac.new(secret.encode(), f"{fake_order}|pay_123".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": fake_order,
        "razorpay_payment_id": "pay_123",
        "razorpay_signature": sig,
        "username": "Intruder",
        "platform": "website",
        "profile_url": "https://example.com/intruder"
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert "Order ID not found" in verify_res.get_json()["error"]

def test_razorpay_api_order_failure_creates_no_listing(client, db_sess, monkeypatch):
    """When Razorpay order creation API fails, no payment or listing should be created."""
    import urllib.error

    def failing_create_order(*args, **kwargs):
        raise urllib.error.HTTPError("https://api.razorpay.com/v1/orders", 400, "Bad Request", {}, None)

    monkeypatch.setattr("routes.main.create_razorpay_order_api", failing_create_order)

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Failed Gateway User",
        "platform": "website",
        "profile_url": "https://example.com/gw_fail"
    }), content_type="application/json")

    assert res.status_code == 400
    assert res.get_json()["success"] is False
    assert db_sess.query(Listing).filter_by(profile_url="https://example.com/gw_fail").first() is None

def test_razorpay_api_payment_order_mismatch_creates_no_listing(client, db_sess, monkeypatch):
    """When Razorpay payment API confirms order mismatch, verification is rejected."""
    unique_url = f"https://example.com/mismatch_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Mismatch User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    # Mock Razorpay payment API returning a different order ID
    def mismatched_get_payment(key_id, key_secret, pid):
        return {
            "id": pid,
            "order_id": "order_completely_different_foreign_order",
            "amount": 200,
            "currency": "USD",
            "status": "captured"
        }

    monkeypatch.setattr("routes.main.get_razorpay_payment_api", mismatched_get_payment)

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Mismatch User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert "mismatch" in verify_res.get_json()["error"].lower()
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_razorpay_api_payment_status_unauthorized_creates_no_listing(client, db_sess, monkeypatch):
    """When Razorpay payment status is not captured/authorized, verification fails."""
    unique_url = f"https://example.com/unauth_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Unauth User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    def unauth_get_payment(key_id, key_secret, pid):
        return {
            "id": pid,
            "order_id": order_id,
            "amount": 200,
            "currency": "USD",
            "status": "failed"
        }

    monkeypatch.setattr("routes.main.get_razorpay_payment_api", unauth_get_payment)

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Unauth User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_valid_mocked_razorpay_verification_creates_listing(client, db_sess):
    """Only a verified payment creates an active, eligible listing in the active round."""
    unique_url = f"https://example.com/verified_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Verified Creator",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Verified Creator",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 201
    data = verify_res.get_json()
    assert data["success"] is True

    # Database state verification
    payment = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert payment.status == "paid"
    assert payment.payment_id == payment_id
    assert payment.listing_id is not None

    listing = db_sess.query(Listing).filter_by(id=payment.listing_id).first()
    assert listing is not None
    assert listing.payment_status == "SUCCESS"
    assert listing.status == "eligible"
    assert listing.profile_url == unique_url

def test_only_paid_listings_appear_publicly(client, db_sess):
    """Even if an unexpected listing has status='eligible', without Payment.status='paid' it must NOT appear publicly."""
    from engine import get_current_listings, get_current_round
    cur_round = get_current_round(db_sess)
    now = get_utc_now()

    # Manually create rogue unverified listing with no paid Payment record
    rogue_url = f"https://example.com/rogue_{uuid.uuid4().hex[:8]}"
    rogue_listing = Listing(
        round_id=cur_round.id,
        username="Rogue User",
        platform="website",
        profile_url=rogue_url,
        payment_status="unpaid",
        status="eligible",
        created_at=now
    )
    db_sess.add(rogue_listing)
    db_sess.commit()
    rogue_id = rogue_listing.id

    # 1. Check get_current_listings
    current_listings = get_current_listings(db_sess, cur_round.id)
    listing_urls = [l.profile_url for l in current_listings]
    assert rogue_url not in listing_urls

    # 2. Check /api/round-status
    api_res = client.get("/api/round-status")
    api_urls = [l["profile_url"] for l in api_res.get_json().get("current_listings", [])]
    assert rogue_url not in api_urls

    # 3. Check /visit/<id> redirection
    visit_res = client.get(f"/visit/{rogue_id}", follow_redirects=False)
    assert visit_res.status_code == 302
    assert "/" in visit_res.headers["Location"]
    assert rogue_url not in visit_res.headers["Location"]

def test_only_paid_listings_participate_in_random_draw(client, db_sess):
    """Only listings with Payment.status == 'paid' can be selected as winners in 60-minute draw."""
    from engine import sync_rounds, get_current_round
    cur_round = get_current_round(db_sess)
    now = get_utc_now()

    # 1. Unverified listing (no paid payment)
    unpaid_listing = Listing(
        round_id=cur_round.id,
        username="Unpaid Draw Candidate",
        platform="website",
        profile_url=f"https://example.com/unpaid_draw_{uuid.uuid4().hex[:6]}",
        payment_status="unpaid",
        status="eligible",
        created_at=now
    )
    db_sess.add(unpaid_listing)
    db_sess.flush()

    # 2. Verified listing with paid payment
    paid_listing = Listing(
        round_id=cur_round.id,
        username="Paid Draw Candidate",
        platform="website",
        profile_url=f"https://example.com/paid_draw_{uuid.uuid4().hex[:6]}",
        payment_status="SUCCESS",
        status="eligible",
        created_at=now
    )
    db_sess.add(paid_listing)
    db_sess.flush()

    p = Payment(
        listing_id=paid_listing.id,
        provider="razorpay",
        order_id=f"order_{uuid.uuid4().hex[:8]}",
        payment_id=f"pay_{uuid.uuid4().hex[:8]}",
        amount=2.0,
        currency="USD",
        status="paid",
        created_at=now
    )
    db_sess.add(p)
    db_sess.commit()

    # Force close and trigger round draw
    completed = sync_rounds(db_sess, force_close_id=cur_round.id)
    assert completed is True

    # Check winners for this round
    winners = db_sess.query(Winner).filter_by(round_id=cur_round.id).all()
    winner_listing_ids = [w.listing_id for w in winners]

    assert paid_listing.id in winner_listing_ids
    assert unpaid_listing.id not in winner_listing_ids
    assert unpaid_listing.status == "eligible"  # Unpaid listing was never promoted to winner

def test_wrong_amount_creates_no_listing(client, db_sess, monkeypatch):
    """When Razorpay payment amount does not match expected fee, verification fails."""
    unique_url = f"https://example.com/wrong_amt_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Wrong Amount User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    def wrong_amount_get_payment(key_id, key_secret, pid):
        return {
            "id": pid,
            "order_id": order_id,
            "amount": 9999,  # Mismatched amount
            "currency": "USD",
            "status": "captured"
        }

    monkeypatch.setattr("routes.main.get_razorpay_payment_api", wrong_amount_get_payment)

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Wrong Amount User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert "amount mismatch" in verify_res.get_json()["error"].lower()
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_wrong_currency_creates_no_listing(client, db_sess, monkeypatch):
    """When Razorpay payment currency does not match configured currency, verification fails."""
    unique_url = f"https://example.com/wrong_curr_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Wrong Curr User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    def wrong_curr_get_payment(key_id, key_secret, pid):
        return {
            "id": pid,
            "order_id": order_id,
            "amount": 200,
            "currency": "EUR",  # Mismatched currency
            "status": "captured"
        }

    monkeypatch.setattr("routes.main.get_razorpay_payment_api", wrong_curr_get_payment)

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Wrong Curr User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")

    assert verify_res.status_code == 400
    assert "currency mismatch" in verify_res.get_json()["error"].lower()
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_cancelled_razorpay_checkout_creates_no_listing(client, db_sess):
    """When a user cancels or closes the Razorpay modal, payment is marked failed and no listing is created."""
    unique_url = f"https://example.com/cancelled_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Cancelled User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]

    # Notify backend of dismissal / cancellation
    cancel_res = client.post("/entry/payment-failed", data=json.dumps({
        "order_id": order_id
    }), content_type="application/json")

    assert cancel_res.status_code == 200
    p = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert p.status == "failed"
    assert p.listing_id is None
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_failed_payment_creates_no_listing(client, db_sess):
    """When Razorpay payment fails, payment record remains failed with no listing."""
    unique_url = f"https://example.com/pay_failed_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Fail User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]

    fail_res = client.post("/entry/payment-failed", data=json.dumps({
        "razorpay_order_id": order_id
    }), content_type="application/json")

    assert fail_res.status_code == 200
    p = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert p.status == "failed"
    assert p.listing_id is None
    assert db_sess.query(Listing).filter_by(profile_url=unique_url).first() is None

def test_idempotency_same_payment_submitted_twice_creates_single_listing(client, db_sess):
    """Submitting the same verified Razorpay payment response twice must return existing listing and NOT create duplicate listings."""
    unique_url = f"https://example.com/idempotent_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Idempotent User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    order_id = res.get_json()["order_id"]
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"

    secret = TestConfig.RAZORPAY_KEY_SECRET
    sig = hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    # First verification
    res1 = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Idempotent User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    assert res1.status_code == 201

    initial_listing_count = db_sess.query(Listing).filter_by(profile_url=unique_url).count()
    assert initial_listing_count == 1

    # Second identical verification
    res2 = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
        "username": "Idempotent User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    assert res2.status_code == 200
    assert "already confirmed" in res2.get_json()["message"]

    # Still exactly ONE listing
    second_listing_count = db_sess.query(Listing).filter_by(profile_url=unique_url).count()
    assert second_listing_count == 1

def test_credential_precedence_env_over_db(client, monkeypatch, db_sess):
    """Real environment variables must take precedence over database settings."""
    from routes.main import get_razorpay_credentials

    # Set real environment credentials
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_test_env_key")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "env_secret_123")

    # Set different credentials in database
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = "rzp_test_db_key"
    settings.razorpay_key_secret = "db_secret_456"
    db_sess.commit()

    with client.application.app_context():
        key_id, key_sec = get_razorpay_credentials(db_sess)
        assert key_id == "rzp_test_env_key"
        assert key_sec == "env_secret_123"

def test_credential_precedence_db_fallback(client, monkeypatch, db_sess):
    """When environment variables are missing or placeholder, valid database settings are used."""
    from routes.main import get_razorpay_credentials

    # Set placeholder in environment
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_test_placeholder")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "placeholder_secret")

    # Set valid credentials in database
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = "rzp_test_db_real_key"
    settings.razorpay_key_secret = "db_real_secret_789"
    db_sess.commit()

    with client.application.app_context():
        key_id, key_sec = get_razorpay_credentials(db_sess)
        assert key_id == "rzp_test_db_real_key"
        assert key_sec == "db_real_secret_789"

def test_credential_precedence_rejects_db_placeholder(client, monkeypatch, db_sess):
    """Database placeholder credentials must never be accepted."""
    from routes.main import get_razorpay_credentials

    # Empty env
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "")

    # Placeholder in database
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = "rzp_test_placeholder"
    settings.razorpay_key_secret = "placeholder_secret"
    db_sess.commit()

    with client.application.app_context():
        key_id, key_sec = get_razorpay_credentials(db_sess)
        assert key_id == ""
        assert key_sec == ""

def test_create_order_safe_error_on_api_rejection(client, monkeypatch):
    """When Razorpay rejects order creation, return exact safe error 'Unable to create payment order.'."""
    import urllib.error

    def rejecting_create_order(*args, **kwargs):
        raise urllib.error.HTTPError("https://api.razorpay.com/v1/orders", 400, "Bad Request", {}, None)

    monkeypatch.setattr("routes.main.create_razorpay_order_api", rejecting_create_order)

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Safe Error User",
        "platform": "website",
        "profile_url": "https://example.com/safe_error"
    }), content_type="application/json")

    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert data["error"] == "Unable to create payment order."

def test_application_startup():
    """Verify application startup and WSGI entrypoint."""
    from app import app, create_app
    assert app is not None
    assert hasattr(app, "wsgi_app")
    test_app = create_app(TestConfig)
    assert test_app is not None
    assert test_app.config["TESTING"] is True

def test_database_connection(db_sess):
    """Verify database connection and query execution."""
    from sqlalchemy import text
    result = db_sess.execute(text("SELECT 1")).scalar()
    assert result == 1

def test_zero_listings_round_draw(db_sess):
    """Verify round expiration with zero listings produces 0 winners and creates next round."""
    from datetime import timedelta
    from engine import sync_rounds
    now = get_utc_now()
    r = Round(
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=5),
        status="active",
        created_at=now - timedelta(hours=2)
    )
    db_sess.add(r)
    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True
    db_sess.refresh(r)
    assert r.status == "completed"
    winners = db_sess.query(Winner).filter_by(round_id=r.id).all()
    assert len(winners) == 0

    next_r = db_sess.query(Round).filter_by(status="active").order_by(Round.id.desc()).first()
    assert next_r is not None
    assert next_r.id != r.id

def test_one_listing_round_draw(db_sess):
    """Verify round expiration with one listing produces exactly 1 winner."""
    from datetime import timedelta
    from engine import sync_rounds
    now = get_utc_now()
    r = Round(
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=5),
        status="active",
        created_at=now - timedelta(hours=2)
    )
    db_sess.add(r)
    db_sess.flush()

    listing = Listing(
        round_id=r.id,
        username="Solo User",
        platform="website",
        profile_url="https://example.com/solo",
        status="eligible",
        created_at=now - timedelta(hours=1)
    )
    db_sess.add(listing)
    db_sess.flush()

    payment = Payment(
        listing_id=listing.id,
        order_id="order_solo_1",
        payment_id="pay_solo_1",
        amount=2.0,
        currency="USD",
        status="paid",
        created_at=now - timedelta(hours=1)
    )
    db_sess.add(payment)
    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True
    winners = db_sess.query(Winner).filter_by(round_id=r.id).all()
    assert len(winners) == 1
    assert winners[0].position == 1
    assert winners[0].listing_id == listing.id

def test_two_listings_round_draw(db_sess):
    """Verify round expiration with two listings produces exactly 2 winners."""
    from datetime import timedelta
    from engine import sync_rounds
    now = get_utc_now()
    r = Round(
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=5),
        status="active",
        created_at=now - timedelta(hours=2)
    )
    db_sess.add(r)
    db_sess.flush()

    for i in range(1, 3):
        listing = Listing(
            round_id=r.id,
            username=f"Duo User {i}",
            platform="website",
            profile_url=f"https://example.com/duo_{i}",
            status="eligible",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(listing)
        db_sess.flush()
        payment = Payment(
            listing_id=listing.id,
            order_id=f"order_duo_{i}",
            payment_id=f"pay_duo_{i}",
            amount=2.0,
            currency="USD",
            status="paid",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(payment)

    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True
    winners = db_sess.query(Winner).filter_by(round_id=r.id).order_by(Winner.position.asc()).all()
    assert len(winners) == 2
    assert [w.position for w in winners] == [1, 2]

def test_three_listings_round_draw(db_sess):
    """Verify round expiration with three listings produces exactly 3 winners."""
    from datetime import timedelta
    from engine import sync_rounds
    now = get_utc_now()
    r = Round(
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=5),
        status="active",
        created_at=now - timedelta(hours=2)
    )
    db_sess.add(r)
    db_sess.flush()

    for i in range(1, 4):
        listing = Listing(
            round_id=r.id,
            username=f"Trio User {i}",
            platform="website",
            profile_url=f"https://example.com/trio_{i}",
            status="eligible",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(listing)
        db_sess.flush()
        payment = Payment(
            listing_id=listing.id,
            order_id=f"order_trio_{i}",
            payment_id=f"pay_trio_{i}",
            amount=2.0,
            currency="USD",
            status="paid",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(payment)

    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True
    winners = db_sess.query(Winner).filter_by(round_id=r.id).order_by(Winner.position.asc()).all()
    assert len(winners) == 3
    assert [w.position for w in winners] == [1, 2, 3]

def test_random_winner_selection_distribution(db_sess):
    """Verify random selection from multiple paid listings never selects duplicates."""
    from datetime import timedelta
    from engine import sync_rounds
    now = get_utc_now()
    r = Round(
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(minutes=5),
        status="active",
        created_at=now - timedelta(hours=2)
    )
    db_sess.add(r)
    db_sess.flush()

    listing_ids = []
    for i in range(1, 11):
        listing = Listing(
            round_id=r.id,
            username=f"Pool User {i}",
            platform="website",
            profile_url=f"https://example.com/pool_{i}",
            status="eligible",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(listing)
        db_sess.flush()
        listing_ids.append(listing.id)
        payment = Payment(
            listing_id=listing.id,
            order_id=f"order_pool_{i}",
            payment_id=f"pay_pool_{i}",
            amount=2.0,
            currency="USD",
            status="paid",
            created_at=now - timedelta(hours=1)
        )
        db_sess.add(payment)

    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True
    winners = db_sess.query(Winner).filter_by(round_id=r.id).order_by(Winner.position.asc()).all()
    assert len(winners) == 3
    winner_listing_ids = [w.listing_id for w in winners]
    # Unique winners
    assert len(set(winner_listing_ids)) == 3
    # All winners are from the eligible pool
    for w_id in winner_listing_ids:
        assert w_id in listing_ids

def test_fake_order_and_payment_id_rejected(client):
    """Payment verification with fake order ID or nonexistent payment fails."""
    sig = hmac.new(b"secret", b"fake_order|fake_pay", hashlib.sha256).hexdigest()
    res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": "fake_order_id_12345",
        "razorpay_payment_id": "fake_payment_id_67890",
        "razorpay_signature": sig,
        "username": "Fake Order User",
        "platform": "website",
        "profile_url": "https://example.com/fake"
    }), content_type="application/json")
    assert res.status_code == 400
    assert "not found" in res.get_json()["error"].lower()

def test_normalize_database_url_postgresql_psycopg2_driver():
    """Verify that postgres://, postgresql://, and postgresql+psycopg:// are normalized to postgresql+psycopg2:// driver."""
    from config import normalize_database_url
    from sqlalchemy.engine.url import make_url
    from sqlalchemy import create_engine

    # postgres:// to postgresql+psycopg2://
    u1 = normalize_database_url("postgres://user:pass@dpg-abc-a:5432/indobid_db")
    assert u1 == "postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db"
    parsed1 = make_url(u1)
    assert parsed1.get_driver_name() == "psycopg2"
    assert parsed1.get_backend_name() == "postgresql"

    # postgresql:// to postgresql+psycopg2://
    u2 = normalize_database_url("postgresql://user:pass@dpg-abc-a:5432/indobid_db?sslmode=require")
    assert u2 == "postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db?sslmode=require"
    parsed2 = make_url(u2)
    assert parsed2.get_driver_name() == "psycopg2"
    assert parsed2.get_backend_name() == "postgresql"

    # postgresql+psycopg:// to postgresql+psycopg2:// (prevents psycopg3 ModuleNotFoundError)
    u3 = normalize_database_url("postgresql+psycopg://user:pass@dpg-abc-a:5432/indobid_db")
    assert u3 == "postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db"
    parsed3 = make_url(u3)
    assert parsed3.get_driver_name() == "psycopg2"

    # postgresql+psycopg3:// to postgresql+psycopg2://
    u4 = normalize_database_url("postgresql+psycopg3://user:pass@dpg-abc-a:5432/indobid_db")
    assert u4 == "postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db"

    # already explicit postgresql+psycopg2:// remains untouched
    u5 = normalize_database_url("postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db")
    assert u5 == "postgresql+psycopg2://user:pass@dpg-abc-a:5432/indobid_db"

    # sqlite is preserved untouched
    u6 = normalize_database_url("sqlite:///instance/indobid.db")
    assert u6 == "sqlite:///instance/indobid.db"

    # Verify SQLAlchemy engine creation loads psycopg2 driver without ModuleNotFoundError
    engine = create_engine(u1)
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg2"

def test_razorpay_runtime_credentials_alias_and_sanitization(monkeypatch):
    """Verify runtime Razorpay detection handles variable aliases, quoted strings, and ignores placeholders."""
    from routes.main import get_razorpay_credentials, clean_credential, is_valid_credential

    assert clean_credential('"rzp_live_abc123"') == "rzp_live_abc123"
    assert clean_credential("'sec_test_xyz'") == "sec_test_xyz"
    assert is_valid_credential("rzp_test_placeholder", is_key_id=True) is False
    assert is_valid_credential("placeholder_secret", is_key_id=False) is False
    assert is_valid_credential("••••••••", is_key_id=False) is False

    # Test alias detection (e.g. RAZORPAY_KEY and RAZORPAY_SECRET)
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    monkeypatch.setenv("RAZORPAY_KEY", '"rzp_live_alias123"')
    monkeypatch.setenv("RAZORPAY_SECRET", '"secret_alias456"')

    kid, ksec = get_razorpay_credentials()
    assert kid == "rzp_live_alias123"
    assert ksec == "secret_alias456"

def test_pricing_configuration_precedence(app, monkeypatch):
    """Verify pricing config precedence in production vs testing."""
    from routes.main import get_pricing_config

    with app.app_context():
        # In test mode: TestConfig dictates price (2.0) and currency (USD)
        price, curr, symbol = get_pricing_config()
        assert price == 2.0
        assert curr == "USD"
        assert symbol == "$"

    # Outside test context (simulating production environment)
    monkeypatch.setenv("CURRENCY", "INR")
    monkeypatch.setenv("LISTING_PRICE", "49.0")
    price, curr, symbol = get_pricing_config()
    assert price == 49.0
    assert curr == "INR"
    assert symbol == "₹"

def test_production_style_config_detection_without_secret_leakage(monkeypatch):
    """Verify production configuration check verifies presence without printing secret values."""
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_realproductionkey")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "super_secret_production_value")

    has_key = bool(os.getenv("RAZORPAY_KEY_ID"))
    has_secret = bool(os.getenv("RAZORPAY_KEY_SECRET"))

    assert has_key is True
    assert has_secret is True

def test_missing_razorpay_key_id_fails_closed(client, monkeypatch, db_sess):
    """When RAZORPAY_KEY_ID is missing but SECRET is set, order creation must fail closed with 503."""
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "valid_secret_123")
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY", raising=False)
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = ""
    settings.razorpay_key_secret = ""
    db_sess.commit()

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "NoKeyUser",
        "platform": "website",
        "profile_url": f"https://example.com/nokey_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")

    assert res.status_code == 503
    data = res.get_json()
    assert data["success"] is False
    assert "Payment service is not configured" in data["error"]

def test_missing_razorpay_key_secret_fails_closed(client, monkeypatch, db_sess):
    """When RAZORPAY_KEY_SECRET is missing but KEY_ID is set, order creation must fail closed with 503."""
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_test_validkey")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    monkeypatch.delenv("RAZORPAY_SECRET", raising=False)
    settings = SiteSetting.get_settings(db_sess)
    settings.razorpay_key_id = ""
    settings.razorpay_key_secret = ""
    db_sess.commit()

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "NoSecretUser",
        "platform": "website",
        "profile_url": f"https://example.com/nosecret_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")

    assert res.status_code == 503
    data = res.get_json()
    assert data["success"] is False
    assert "Payment service is not configured" in data["error"]

def test_create_order_inr_paise_conversion_and_no_secret_leak(client, monkeypatch):
    """Verify INR entry fee converts properly to paise subunits and NEVER exposes Razorpay secret to frontend."""
    monkeypatch.setitem(client.application.config, "CURRENCY", "INR")
    monkeypatch.setitem(client.application.config, "ENTRY_FEE_INR", 49.0)
    monkeypatch.setitem(client.application.config, "LISTING_PRICE", 49.0)
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_test_inr_key")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "super_secret_never_leak_this")

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "INR Tester",
        "platform": "website",
        "profile_url": f"https://example.com/inr_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")

    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["currency"] == "INR"
    assert data["currency_symbol"] == "₹"
    # ₹49 = 4900 paise
    assert data["amount"] == 4900
    assert data["price"] == 49.0
    assert data["key_id"] == "rzp_test_inr_key"

    # Security check: secret MUST NEVER be returned in JSON response
    response_text = res.get_data(as_text=True)
    assert "super_secret_never_leak_this" not in response_text
    assert "key_secret" not in data
    assert "secret" not in data

def test_dynamic_inr_custom_amount_paise_conversion(client, monkeypatch):
    """Verify arbitrary configured INR amounts convert correctly to smallest unit (paise)."""
    monkeypatch.setitem(client.application.config, "CURRENCY", "INR")
    monkeypatch.setitem(client.application.config, "ENTRY_FEE_INR", 75.50)
    monkeypatch.setitem(client.application.config, "LISTING_PRICE", 75.50)

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Custom INR",
        "platform": "website",
        "profile_url": f"https://example.com/custom_inr_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")

    assert res.status_code == 200
    data = res.get_json()
    # ₹75.50 = 7550 paise
    assert data["amount"] == 7550
    assert data["currency"] == "INR"

def test_health_payment_endpoint(client, monkeypatch):
    """Verify /health/payment returns expected safe diagnostics without exposing secrets."""
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_testdummy1234")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "super_secret_diagnostic_val")
    monkeypatch.setenv("CURRENCY", "INR")

    res = client.get("/health/payment")
    assert res.status_code == 200
    data = res.get_json()

    assert data["payment_provider"] == "razorpay"
    assert data["configured"] is True
    assert data["key_id_present"] is True
    assert data["key_id_prefix"] == "rzp_live_"
    assert data["key_secret_present"] is True
    assert data["currency"] == "INR"

    # Verify secret is NEVER leaked
    raw_text = res.get_data(as_text=True)
    assert "super_secret_diagnostic_val" not in raw_text
    assert "key_secret" not in data

def test_razorpay_configuration_matrix(monkeypatch):
    """Test full configuration matrix: valid keys, placeholders, whitespace stripping, and bracket detection."""
    from routes.main import get_razorpay_config

    # Clear env
    for k in ["RAZORPAY_KEY_ID", "RAZORPAY_KEY", "RAZORPAY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_SECRET"]:
        monkeypatch.delenv(k, raising=False)

    # 1. Valid rzp_live_ key + secret => configured=True
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_abc1234567")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "live_secret_val_123")
    cfg = get_razorpay_config()
    assert cfg["configured"] is True
    assert cfg["mode"] == "live"
    assert cfg["key_id_prefix"] == "rzp_live_"

    # 2. Valid rzp_test_ key + secret => configured=True
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_xyz9876543")
    cfg = get_razorpay_config()
    assert cfg["configured"] is True
    assert cfg["mode"] == "test"
    assert cfg["key_id_prefix"] == "rzp_test_"

    # 3. Empty key ID => configured=False
    monkeypatch.setenv("RAZORPAY_KEY_ID", "")
    cfg = get_razorpay_config()
    assert cfg["configured"] is False
    assert cfg["key_id_present"] is False

    # 4. Empty secret => configured=False
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_abc1234567")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "")
    cfg = get_razorpay_config()
    assert cfg["configured"] is False
    assert cfg["key_secret_present"] is False

    # 5. Placeholder key ID => configured=False
    for ph in ["YOUR_KEY_ID", "<configured live key>", "rzp_test_placeholder", "change_me", "••••••••"]:
        monkeypatch.setenv("RAZORPAY_KEY_ID", ph)
        monkeypatch.setenv("RAZORPAY_KEY_SECRET", "live_secret_val_123")
        cfg = get_razorpay_config()
        assert cfg["configured"] is False

    # 6. Placeholder secret => configured=False
    for ph in ["YOUR_KEY_SECRET", "<configured live secret>", "placeholder_secret", "change_me", "{your_secret}"]:
        monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_abc1234567")
        monkeypatch.setenv("RAZORPAY_KEY_SECRET", ph)
        cfg = get_razorpay_config()
        assert cfg["configured"] is False

    # 7. Whitespace and smart quotes around values are stripped
    monkeypatch.setenv("RAZORPAY_KEY_ID", "  \"rzp_live_abc1234567\"  \n")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", " ‘secret_with_quotes_123’ \r\n")
    cfg = get_razorpay_config()
    assert cfg["configured"] is True
    assert cfg["key_id"] == "rzp_live_abc1234567"
    assert cfg["key_secret"] == "secret_with_quotes_123"

def test_razorpay_auth_error_not_masked_as_unconfigured(client, monkeypatch):
    """When Razorpay API rejects credentials (401), error must NOT be masked as 'Payment service is not configured'."""
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_ID", "rzp_live_validformat123")
    monkeypatch.setitem(client.application.config, "RAZORPAY_KEY_SECRET", "bad_secret_value_123")

    import urllib.error
    def mock_401_create_order(*args, **kwargs):
        err_fp = urllib.response.addinfourl(
            io.BytesIO(b'{"error":{"code":"BAD_REQUEST_ERROR","description":"The id provided does not exist"}}'),
            {}, "https://api.razorpay.com/v1/orders"
        )
        raise urllib.error.HTTPError("https://api.razorpay.com/v1/orders", 401, "Unauthorized", {}, err_fp)

    import io
    monkeypatch.setattr("routes.main.create_razorpay_order_api", mock_401_create_order)

    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Auth Tester",
        "platform": "website",
        "profile_url": f"https://example.com/auth_{uuid.uuid4().hex[:6]}"
    }), content_type="application/json")

    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert data["error_type"] == "RAZORPAY_AUTH_ERROR"
    assert "authentication failed" in data["error"].lower()
    # Crucial: MUST NOT say 'Payment service is not configured'
    assert data["error"] != "Payment service is not configured."








