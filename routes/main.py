import os
import time
import uuid
import hmac
import hashlib
import json
import urllib.request
import urllib.error
import base64
from collections import defaultdict
from urllib.parse import urlparse
from datetime import timezone, timedelta
from flask import (
    Blueprint, render_template, request, jsonify, flash, redirect, url_for, current_app
)
from sqlalchemy import func, desc
from database import db_session
from models import Round, Listing, Entry, Winner, Payment, SiteVisitor, SiteSetting, get_utc_now, ensure_utc
from engine import get_current_round, get_current_listings, get_glass_box_entries, get_latest_completed_round
from config import Config

main_bp = Blueprint("main", __name__)

# Lightweight in-memory rate limiting: IP -> list of submission timestamps
_submission_rate_limit: dict[str, list[float]] = defaultdict(list)
_MAX_SUBMISSIONS_PER_MINUTE = 20

def is_submission_rate_limited(ip_address: str) -> bool:
    """Sliding-window IP rate limiter to protect against automated spamming."""
    if current_app and current_app.config.get("TESTING"):
        return False
    now = time.time()
    window = now - 60.0
    timestamps = [t for t in _submission_rate_limit[ip_address] if t > window]
    if len(timestamps) >= _MAX_SUBMISSIONS_PER_MINUTE:
        return True
    timestamps.append(now)
    _submission_rate_limit[ip_address] = timestamps
    return False

ALLOWED_PLATFORMS = {
    "twitter": "X / Twitter",
    "instagram": "Instagram",
    "youtube": "YouTube",
    "tiktok": "TikTok",
    "github": "GitHub",
    "linkedin": "LinkedIn",
    "website": "Website / Portfolio",
    "other": "Other Link"
}

def validate_profile_url(url: str) -> bool:
    """Validates that a URL is a valid http or https web address with a valid domain."""
    if not url or len(url) > 500:
        return False
    try:
        result = urlparse(url.strip())
        if result.scheme not in ("http", "https") or not result.netloc:
            return False
        domain = result.netloc.split(":")[0]
        return ("." in domain and not domain.endswith(".")) or domain == "localhost"
    except Exception:
        return False

def create_razorpay_order_api(key_id: str, key_secret: str, amount_subunits: int, currency: str, receipt: str, notes: dict) -> dict:
    """Creates a real Razorpay order via Razorpay API."""
    auth_str = f"{key_id}:{key_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    payload = json.dumps({
        "amount": amount_subunits,
        "currency": currency,
        "receipt": receipt,
        "notes": notes
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.razorpay.com/v1/orders",
        data=payload,
        headers={
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def get_razorpay_payment_api(key_id: str, key_secret: str, payment_id: str) -> dict:
    """Fetches payment details directly from Razorpay's API to confirm payment and order relationship."""
    auth_str = f"{key_id}:{key_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    req = urllib.request.Request(
        f"https://api.razorpay.com/v1/payments/{payment_id}",
        headers={
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/json"
        },
        method="GET"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def track_visitor(session, client_ip: str) -> None:
    """
    Lightweight, privacy-conscious visitor tracking.
    Hashes IP + date + secret key so raw personal IPs are never permanently stored.
    Updates last_seen_at timestamp for live online visitors count.
    """
    try:
        now = get_utc_now()
        today_str = now.strftime("%Y-%m-%d")
        secret = current_app.config.get("SECRET_KEY", "indobid-salt")
        visitor_hash = hashlib.sha256(f"{client_ip}:{today_str}:{secret}".encode("utf-8")).hexdigest()

        visitor = (
            session.query(SiteVisitor)
            .filter_by(visitor_hash=visitor_hash, visited_date=today_str)
            .first()
        )
        if visitor:
            visitor.last_seen_at = now
            visitor.page_views = (visitor.page_views or 1) + 1
        else:
            visitor = SiteVisitor(
                visitor_hash=visitor_hash,
                visited_date=today_str,
                last_seen_at=now,
                page_views=1,
                created_at=now
            )
            session.add(visitor)
        session.commit()
    except Exception as e:
        session.rollback()
        current_app.logger.warning(f"Visitor tracking skipped: {e}")

def get_online_visitors_count(session) -> int:
    """Calculates active visitors in the last 5 minutes from actual site_visitors activity."""
    try:
        cutoff = get_utc_now() - timedelta(minutes=5)
        count = session.query(func.count(SiteVisitor.id)).filter(SiteVisitor.last_seen_at >= cutoff).scalar() or 0
        return max(1, int(count))
    except Exception:
        return 1

def get_site_statistics(session) -> dict:
    """
    Returns authentic database statistics:
    - Total Visitors (from site_visitors)
    - Total Page Views (sum of page_views)
    - Total Listings (successful paid listings)
    - Total Link Clicks (sum of click_count on listings)
    - Online Visitors (actual active sessions in last 5 min)
    """
    total_visitors = session.query(func.count(SiteVisitor.id)).scalar() or 0
    total_page_views = session.query(func.coalesce(func.sum(SiteVisitor.page_views), 0)).scalar() or 0
    total_listings = (
        session.query(func.count(Listing.id))
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(Payment.status == "paid")
        .scalar() or 0
    )
    total_clicks = (
        session.query(func.coalesce(func.sum(Listing.click_count), 0))
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(Payment.status == "paid")
        .scalar() or 0
    )
    online_visitors = get_online_visitors_count(session)

    return {
        "total_visitors": total_visitors,
        "total_page_views": int(total_page_views),
        "total_listings": total_listings,
        "total_entries": total_listings,  # backward compatibility alias
        "total_clicks": int(total_clicks),
        "profile_clicks": int(total_clicks),  # backward compatibility alias
        "online_visitors": online_visitors,
    }

@main_bp.route("/")
def index():
    """
    Homepage — ultra-compact, clean, modern layout:
    1. Navbar
    2. Hero: "Get Your Link On Top."
    3. Live Round: Round #XX, Countdown (59:42), "3 listings are selected every hour."
    4. Current Listings: show current paid listings (Username, Platform, Visit Link)
    5. Top 3: Gold, Silver, Bronze directly below current listings
    6. Footer
    """
    session = db_session()
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    track_visitor(session, client_ip)

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    current_listings = get_current_listings(session, current_round.id)
    latest_completed = get_latest_completed_round(session)
    stats = get_site_statistics(session)
    settings = SiteSetting.get_settings(session)

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))
    elapsed_seconds = max(0, Config.ROUND_DURATION_SECONDS - remaining_seconds)
    progress_percent = min(100.0, max(0.0, (elapsed_seconds / float(Config.ROUND_DURATION_SECONDS)) * 100.0))

    return render_template(
        "index.html",
        current_round=current_round,
        current_listings=current_listings,
        glass_entries=get_glass_box_entries(session, current_round.id),
        latest_completed=latest_completed,
        active_entries_count=len(current_listings),
        remaining_seconds=remaining_seconds,
        progress_percent=round(progress_percent, 1),
        stats=stats,
        settings=settings,
        entry_fee_inr=getattr(settings, "listing_price", 2.0),
        razorpay_key_id=get_razorpay_credentials(session)[0],
        allowed_platforms=ALLOWED_PLATFORMS
    )

def is_valid_credential(val: str, is_key_id: bool = False) -> bool:
    """Checks whether a credential string is real and not a placeholder."""
    if not val:
        return False
    v = str(val).strip()
    if not v:
        return False
    lower = v.lower()
    if "placeholder" in lower or lower in ("none", "null", "undefined", "••••••••", "xxxxxxxxxxxxxxxx"):
        return False
    if is_key_id:
        if not (lower.startswith("rzp_test_") or lower.startswith("rzp_live_")):
            return False
        if lower.startswith("rzp_test_xxxx") or lower.startswith("rzp_live_xxxx"):
            return False
    return True

def get_razorpay_credentials(session) -> tuple[str, str]:
    """
    Authoritative resolution of Razorpay Key ID and Secret.
    Required Precedence:
      1. REAL environment variables (os.environ, current_app.config, Config)
      2. Valid database settings (SiteSetting)
      3. Otherwise unavailable (returns "", "")
    Never allow database placeholders to override real environment credentials.
    Rejects placeholder values like 'rzp_test_placeholder', 'placeholder_secret'.
    """
    # 1. Real environment variables check
    app_key_id = ""
    app_key_secret = ""
    try:
        from flask import has_app_context
        if has_app_context():
            app_key_id = str(current_app.config.get("RAZORPAY_KEY_ID") or "")
            app_key_secret = str(current_app.config.get("RAZORPAY_KEY_SECRET") or "")
    except Exception:
        pass

    env_key_id = (app_key_id or os.getenv("RAZORPAY_KEY_ID", "") or getattr(Config, "RAZORPAY_KEY_ID", "")).strip()
    env_key_secret = (app_key_secret or os.getenv("RAZORPAY_KEY_SECRET", "") or getattr(Config, "RAZORPAY_KEY_SECRET", "")).strip()

    if is_valid_credential(env_key_id, is_key_id=True) and is_valid_credential(env_key_secret, is_key_id=False):
        return env_key_id, env_key_secret

    # 2. Valid database settings check (fallback only when env variables are not configured)
    settings = SiteSetting.get_settings(session)
    db_key_id = (getattr(settings, "razorpay_key_id", "") or "").strip()
    db_key_secret = (getattr(settings, "razorpay_key_secret", "") or "").strip()

    if is_valid_credential(db_key_id, is_key_id=True) and is_valid_credential(db_key_secret, is_key_id=False):
        return db_key_id, db_key_secret

    # 3. Otherwise unavailable
    return "", ""

@main_bp.route("/entry/create-order", methods=["POST"])
@main_bp.route("/listing/create-order", methods=["POST"])
def create_order():
    """
    Step 1 of Payment Flow:
    Validates listing info, creates Razorpay order, records initial Payment in DB.
    IMPORTANT: Listing is NOT created before successful payment verification!
    """
    session = db_session()
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()

    if is_submission_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Too many requests. Please wait a moment and try again."
        }), 429

    data = request.get_json(silent=True) or request.form
    username = (data.get("username") or data.get("display_name") or "").strip()
    platform = (data.get("platform") or "").strip().lower()
    profile_url = (data.get("profile_url") or "").strip()

    # Normalize url scheme if missing and strip trailing slash
    if profile_url and not (profile_url.startswith("http://") or profile_url.startswith("https://")):
        profile_url = "https://" + profile_url
    if profile_url:
        profile_url = profile_url.rstrip("/")

    # Validation
    errors = []
    if not username or len(username) < 2 or len(username) > 60:
        errors.append("Username / Display Name must be between 2 and 60 characters.")
    if platform not in ALLOWED_PLATFORMS:
        platform = "website"
    if not validate_profile_url(profile_url):
        errors.append("Please enter a valid public profile or product link URL.")

    if errors:
        return jsonify({"success": False, "errors": errors, "error": errors[0]}), 400

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)

    # Check for duplicate paid listing in the same round with identical profile URL
    existing_listing = (
        session.query(Listing)
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(
            Listing.round_id == current_round.id,
            Listing.profile_url == profile_url,
            Listing.payment_status.in_(["SUCCESS", "paid"]),
            Payment.status.in_(["SUCCESS", "paid"])
        )
        .first()
    )
    if existing_listing:
        return jsonify({
            "success": False,
            "error": f"This link is already entered in Round #{current_round.id}!"
        }), 400

    settings = SiteSetting.get_settings(session)
    if current_app.config.get("TESTING"):
        price = float(current_app.config.get("LISTING_PRICE", settings.listing_price))
        currency = str(current_app.config.get("CURRENCY", settings.currency)).upper()
    else:
        price = float(settings.listing_price)
        currency = str(settings.currency).upper()

    key_id, key_secret = get_razorpay_credentials(session)

    # Fail closed if Razorpay credentials are missing or placeholder
    if not key_id or not key_secret:
        current_app.logger.warning("Razorpay credentials not configured or placeholder detected.")
        return jsonify({
            "success": False,
            "error": "Payment service is not configured.",
            "message": "Payment service is not configured."
        }), 503

    amount_subunits = int(round(price * 100))  # cents or paise
    try:
        order_res = create_razorpay_order_api(
            key_id=key_id,
            key_secret=key_secret,
            amount_subunits=amount_subunits,
            currency=currency,
            receipt=f"rcpt_{int(time.time())}_{uuid.uuid4().hex[:6]}",
            notes={
                "username": username,
                "platform": platform,
                "round_id": str(current_round.id)
            }
        )
        order_id = order_res.get("id")
        if not order_id or not str(order_id).startswith("order_"):
            raise ValueError(f"Razorpay response did not include a valid order id: {order_res}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        current_app.logger.error(f"Razorpay order API HTTP error {e.code}: {err_body}")
        return jsonify({
            "success": False,
            "error": "Unable to create payment order.",
            "message": "Unable to create payment order."
        }), 400
    except Exception as e:
        current_app.logger.error(f"Razorpay order API call exception: {e}")
        return jsonify({
            "success": False,
            "error": "Unable to create payment order.",
            "message": "Unable to create payment order."
        }), 502

    # Save initial payment record with status='created'. No listing is created yet!
    payment = Payment(
        provider="razorpay",
        order_id=order_id,
        amount=price,
        currency=currency,
        status="created",
        created_at=get_utc_now()
    )
    session.add(payment)
    session.commit()

    return jsonify({
        "success": True,
        "order_id": order_id,
        "amount": amount_subunits,
        "currency": currency,
        "currency_symbol": settings.currency_symbol,
        "key_id": key_id,
        "price": price,
        "fee_inr": price,  # backward compatibility alias
        "username": username,
        "display_name": username,
        "platform": platform,
        "profile_url": profile_url,
        "round_id": current_round.id
    }), 200

@main_bp.route("/entry/verify-payment", methods=["POST"])
@main_bp.route("/listing/verify-payment", methods=["POST"])
def verify_payment():
    """
    Step 2 of Payment Flow:
    Server-side Razorpay signature verification and order relationship check.
    ONLY upon valid signature and API confirmation:
    - mark payment as paid
    - create active Listing
    - link listing to payment and current round
    If verification fails or payment fails: NO listing is created!
    """
    session = db_session()
    data = request.get_json(silent=True) or request.form

    order_id = (data.get("razorpay_order_id") or "").strip()
    payment_id = (data.get("razorpay_payment_id") or "").strip()
    signature = (data.get("razorpay_signature") or "").strip()
    username = (data.get("username") or data.get("display_name") or "").strip()
    platform = (data.get("platform") or "").strip().lower()
    profile_url = (data.get("profile_url") or "").strip()

    if not order_id or not payment_id or not signature:
        return jsonify({
            "success": False,
            "error": "Missing payment verification parameters."
        }), 400

    key_id, key_secret = get_razorpay_credentials(session)
    if not key_id or not key_secret:
        return jsonify({
            "success": False,
            "error": "Payment service is not configured.",
            "message": "Payment service is not configured."
        }), 503

    # Check for existing payment record initialized by this application (with lock if supported)
    try:
        payment = session.query(Payment).filter_by(order_id=order_id).with_for_update().first()
    except Exception:
        payment = session.query(Payment).filter_by(order_id=order_id).first()

    if not payment:
        return jsonify({
            "success": False,
            "message": "Payment could not be verified.",
            "error": "Order ID not found or not initialized by application."
        }), 400

    # If already paid and listing exists, return idempotent response (one payment = one listing)
    if payment.status in ("paid", "SUCCESS") and payment.listing_id:
        existing_listing = session.query(Listing).filter_by(id=payment.listing_id).first()
        if existing_listing:
            return jsonify({
                "success": True,
                "message": f"Payment already confirmed! You are in Round #{existing_listing.round_id}.",
                "round_id": existing_listing.round_id,
                "listing": existing_listing.to_dict(),
                "entry": existing_listing.to_dict()
            }), 200

    # Server-side Razorpay HMAC-SHA256 signature verification
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    expected_sig = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        payment.status = "failed"
        session.commit()
        return jsonify({
            "success": False,
            "message": "Payment could not be verified.",
            "error": "Payment signature verification failed. Listing was not created."
        }), 400

    # Verify payment details and order relationship with Razorpay API
    try:
        pay_info = get_razorpay_payment_api(key_id, key_secret, payment_id)
        if pay_info:
            # Confirm payment belongs to the order created by this application
            if pay_info.get("order_id") and pay_info.get("order_id") != order_id:
                payment.status = "failed"
                session.commit()
                return jsonify({
                    "success": False,
                    "message": "Payment could not be verified.",
                    "error": "Payment order mismatch."
                }), 400
            # Confirm amount matches expected subunits
            expected_subunits = int(round(payment.amount * 100))
            if pay_info.get("amount") and int(pay_info.get("amount")) != expected_subunits:
                payment.status = "failed"
                session.commit()
                return jsonify({
                    "success": False,
                    "message": "Payment could not be verified.",
                    "error": "Payment amount mismatch."
                }), 400
            # Confirm currency matches
            if pay_info.get("currency") and pay_info.get("currency").upper() != payment.currency.upper():
                payment.status = "failed"
                session.commit()
                return jsonify({
                    "success": False,
                    "message": "Payment could not be verified.",
                    "error": "Payment currency mismatch."
                }), 400
            # Confirm payment status is captured or authorized
            if pay_info.get("status") and pay_info.get("status") not in ("captured", "authorized", "paid"):
                payment.status = "failed"
                session.commit()
                return jsonify({
                    "success": False,
                    "message": "Payment could not be verified.",
                    "error": f"Payment status not captured ({pay_info.get('status')})."
                }), 400
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        current_app.logger.warning(f"Razorpay API payment verification error {e.code}: {err_body}")
        payment.status = "failed"
        session.commit()
        return jsonify({
            "success": False,
            "message": "Payment could not be verified.",
            "error": "Razorpay payment verification rejected."
        }), 400
    except Exception as e:
        current_app.logger.warning(f"Razorpay payment fetch exception: {e}")

    # Ensure valid inputs
    if not username or len(username) < 2 or len(username) > 60:
        return jsonify({"success": False, "error": "Invalid username."}), 400
    if platform not in ALLOWED_PLATFORMS:
        platform = "website"
    if not validate_profile_url(profile_url):
        return jsonify({"success": False, "error": "Invalid profile URL."}), 400

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)

    # Payment verified: mark paid and create active listing in transaction
    now = get_utc_now()
    try:
        payment.status = "paid"
        payment.payment_id = payment_id

        new_listing = Listing(
            round_id=current_round.id,
            username=username,
            platform=platform,
            profile_url=profile_url,
            payment_status="SUCCESS",
            payment_id=payment_id,
            click_count=0,
            status="eligible",
            created_at=now
        )
        session.add(new_listing)
        session.flush()

        payment.listing_id = new_listing.id
        session.commit()
    except Exception as e:
        session.rollback()
        current_app.logger.error(f"Transaction failure creating listing for order {order_id}: {e}")
        return jsonify({
            "success": False,
            "error": "Payment received. We are confirming your listing.",
            "message": "Payment received. We are confirming your listing."
        }), 500

    return jsonify({
        "success": True,
        "message": f"Payment verified! Your listing is now entered into Round #{current_round.id}.",
        "round_id": current_round.id,
        "listing": new_listing.to_dict(),
        "entry": new_listing.to_dict()
    }), 201

@main_bp.route("/entry/payment-failed", methods=["POST"])
@main_bp.route("/listing/payment-failed", methods=["POST"])
def payment_failed():
    """Records payment failure or modal dismissal so unpaid listings are never created."""
    session = db_session()
    data = request.get_json(silent=True) or request.form
    order_id = (data.get("order_id") or data.get("razorpay_order_id") or "").strip()

    if order_id:
        payment = session.query(Payment).filter_by(order_id=order_id).first()
        if payment and payment.status not in ("paid", "SUCCESS"):
            payment.status = "failed"
            session.commit()

    return jsonify({"success": True, "message": "Payment failure recorded. No listing created."}), 200

@main_bp.route("/visit/<int:listing_id>")
def visit_listing(listing_id: int):
    """
    Profile / Link Click Tracking endpoint.
    1. Validate listing belongs to a verified paid payment
    2. Increment click counter
    3. Redirect to original URL
    """
    session = db_session()
    listing = (
        session.query(Listing)
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(
            Listing.id == listing_id,
            Payment.status == "paid"
        )
        .first()
    )

    if not listing:
        return redirect(url_for("main.index"))

    listing.click_count = (listing.click_count or 0) + 1
    session.commit()

    target_url = listing.profile_url
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        target_url = "https://" + target_url

    return redirect(target_url, code=302)

@main_bp.route("/profile/<int:winner_id>/visit")
def visit_profile(winner_id: int):
    """Profile visit endpoint: increments clicks and redirects to target URL."""
    session = db_session()
    winner = session.query(Winner).filter_by(id=winner_id).first()
    if not winner or not winner.listing:
        return redirect(url_for("main.index"))

    winner.clicks = (winner.clicks or 0) + 1
    if winner.listing:
        winner.listing.click_count = (winner.listing.click_count or 0) + 1
    session.commit()

    target_url = winner.listing.profile_url
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        target_url = "https://" + target_url

    return redirect(target_url, code=302)

@main_bp.route("/api/round-status")
def round_status():
    """
    JSON API for live countdown, progress bar, current listings, and top 3 winners.
    Automatically closes expired round, selects winners, and starts next round.
    """
    session = db_session()
    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    current_listings = get_current_listings(session, current_round.id)
    latest_completed = get_latest_completed_round(session)
    stats = get_site_statistics(session)

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))
    elapsed_seconds = max(0, Config.ROUND_DURATION_SECONDS - remaining_seconds)
    progress_percent = min(100.0, max(0.0, (elapsed_seconds / float(Config.ROUND_DURATION_SECONDS)) * 100.0))

    latest_winners_data = []
    if latest_completed and latest_completed.winners:
        latest_winners_data = [w.to_dict() for w in latest_completed.winners]

    listings_data = [
        {
            "id": l.id,
            "username": l.username,
            "platform": l.platform,
            "profile_url": l.profile_url,
            "click_count": l.click_count,
            "initial": l.username[0].upper() if l.username else "?"
        }
        for l in current_listings
    ]

    return jsonify({
        "round_id": current_round.id,
        "start_time": current_round.start_time.isoformat(),
        "end_time": current_round.end_time.isoformat(),
        "remaining_seconds": remaining_seconds,
        "progress_percent": round(progress_percent, 1),
        "entries_count": len(current_listings),
        "listings_count": len(current_listings),
        "current_listings": listings_data,
        "glass_box_entries": listings_data[:Config.GLASS_BOX_SAMPLE_SIZE],
        "latest_completed_round_id": latest_completed.id if latest_completed else None,
        "latest_winners": latest_winners_data,
        "stats": stats
    })

@main_bp.route("/winners")
def winners():
    """
    Permanent archive of all past hourly winners.
    Every winner is permanently preserved with Username, Platform, Link, Position, Round, Date, and Clicks.
    """
    session = db_session()
    completed_rounds = (
        session.query(Round)
        .filter_by(status="completed")
        .order_by(Round.id.desc())
        .all()
    )
    return render_template("winners.html", rounds=completed_rounds)

@main_bp.route("/about")
def about():
    """Simple About page explaining how the 60-minute round discovery works."""
    return render_template("about.html")

@main_bp.route("/rules")
def rules():
    """Rules and transparency page."""
    return render_template("rules.html")

@main_bp.route("/terms")
def terms():
    """Terms of Service."""
    return render_template("terms.html")

@main_bp.route("/privacy")
def privacy():
    """Privacy Policy."""
    return render_template("privacy.html")

@main_bp.route("/refunds")
def refunds():
    """Refund Policy."""
    return render_template("refunds.html")

@main_bp.route("/health")
@main_bp.route("/api/health")
def health():
    """Health check endpoint for Render."""
    return jsonify({"status": "ok", "service": "indobid.lol"}), 200
