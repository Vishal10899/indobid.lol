import json
import uuid
import hmac
import hashlib
from config import Config, TestConfig
from models import Winner, Entry, Listing, Round, Payment, SiteVisitor, get_utc_now

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
    p = Payment(provider="razorpay", order_id=order_id, amount=49.0, status="created", created_at=get_utc_now())
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

    p = Payment(provider="razorpay", order_id=order_id, amount=49.0, status="created", created_at=get_utc_now())
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

    # Trigger Seed
    seed_res = client.post("/admin/seed-entries", follow_redirects=True)
    assert seed_res.status_code == 200
    assert "Successfully added" in seed_res.get_data(as_text=True)

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

def test_seed_entries_disabled_in_production(client):
    # Log in first
    client.post(
        "/admin/login",
        data={"email": TestConfig.ADMIN_EMAIL, "password": TestConfig.ADMIN_PASSWORD},
        follow_redirects=True
    )

    original_prod = Config.IS_PRODUCTION
    try:
        Config.IS_PRODUCTION = True
        res = client.post("/admin/seed-entries", follow_redirects=True)
        assert res.status_code == 200
        assert "strictly disabled in production" in res.get_data(as_text=True)
    finally:
        Config.IS_PRODUCTION = original_prod

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
    db_sess.commit()

    # Visit /visit/<listing_id>
    response = client.get(f"/visit/{listing.id}", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"] == "https://tester.com/myproduct"

    # Verify click counter incremented from 5 to 6
    updated_listing = db_sess.query(Listing).filter_by(id=listing.id).first()
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

def test_create_order_test_mode_and_verification_flow(client, db_sess):
    unique_url = f"https://example.com/test_mode_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Test Mode User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["is_test_mode"] is True
    assert "test_payment_id" in data
    assert "test_signature" in data
    assert data["test_signature"] is not None

    # Verify payment using test mode credentials returned
    verify_res = client.post("/entry/verify-payment", data=json.dumps({
        "razorpay_order_id": data["order_id"],
        "razorpay_payment_id": data["test_payment_id"],
        "razorpay_signature": data["test_signature"],
        "username": "Test Mode User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    assert verify_res.status_code == 201
    vdata = verify_res.get_json()
    assert vdata["success"] is True

    # Listing must be active and present in round
    payment = db_sess.query(Payment).filter_by(order_id=data["order_id"]).first()
    assert payment.status == "paid"
    listing = db_sess.query(Listing).filter_by(id=payment.listing_id).first()
    assert listing is not None
    assert listing.payment_status == "SUCCESS"
    assert listing.profile_url == unique_url

def test_payment_failed_records_status(client, db_sess):
    unique_url = f"https://example.com/failed_{uuid.uuid4().hex[:8]}"
    res = client.post("/entry/create-order", data=json.dumps({
        "username": "Fail User",
        "platform": "website",
        "profile_url": unique_url
    }), content_type="application/json")
    data = res.get_json()
    order_id = data["order_id"]

    fail_res = client.post("/entry/payment-failed", data=json.dumps({
        "order_id": order_id
    }), content_type="application/json")
    assert fail_res.status_code == 200

    payment = db_sess.query(Payment).filter_by(order_id=order_id).first()
    assert payment.status == "failed"
    assert payment.listing_id is None


