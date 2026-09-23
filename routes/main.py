import time
import uuid
import hmac
import hashlib
import json
import urllib.request
import base64
from collections import defaultdict
from urllib.parse import urlparse
from datetime import timezone
from flask import (
    Blueprint, render_template, request, jsonify, flash, redirect, url_for, current_app
)
from sqlalchemy import func, desc
from database import db_session
from models import Round, Entry, Winner, Payment, SiteVisitor, get_utc_now, ensure_utc
from engine import get_current_round, get_glass_box_entries, get_latest_completed_round
from config import Config

main_bp = Blueprint("main", __name__)

# Lightweight in-memory rate limiting: IP -> list of submission timestamps
_submission_rate_limit: dict[str, list[float]] = defaultdict(list)
_MAX_SUBMISSIONS_PER_MINUTE = 20

def is_submission_rate_limited(ip_address: str) -> bool:
    """Sliding-window IP rate limiter to protect against automated spamming."""
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
    "other": "Other Profile"
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

def track_visitor(session, client_ip: str) -> None:
    """
    Privacy-conscious visitor tracking.
    Hashes IP + date + secret key so raw personal IPs are never permanently stored.
    Counts unique daily visits genuinely in the database.
    """
    try:
        now = get_utc_now()
        today_str = now.strftime("%Y-%m-%d")
        secret = current_app.config.get("SECRET_KEY", "indobid-salt")
        visitor_hash = hashlib.sha256(f"{client_ip}:{today_str}:{secret}".encode("utf-8")).hexdigest()

        exists = (
            session.query(SiteVisitor)
            .filter_by(visitor_hash=visitor_hash, visited_date=today_str)
            .first()
        )
        if not exists:
            visitor = SiteVisitor(
                visitor_hash=visitor_hash,
                visited_date=today_str,
                created_at=now
            )
            session.add(visitor)
            session.commit()
    except Exception as e:
        session.rollback()
        current_app.logger.warning(f"Visitor tracking skipped: {e}")

def get_site_statistics(session) -> dict:
    """
    Returns authentic database statistics:
    - Total Visitors (from site_visitors)
    - Total Entries (successful paid entries)
    - Profile Clicks (sum of clicks on featured winner profiles)
    """
    total_visitors = session.query(func.count(SiteVisitor.id)).scalar() or 0
    total_entries = (
        session.query(func.count(Payment.id))
        .filter(Payment.status == "paid")
        .scalar() or 0
    )
    profile_clicks = session.query(func.coalesce(func.sum(Winner.clicks), 0)).scalar() or 0

    return {
        "total_visitors": total_visitors,
        "total_entries": total_entries,
        "profile_clicks": int(profile_clicks),
    }

@main_bp.route("/")
def index():
    """
    Homepage — compact, fast, SaaS-inspired light theme.
    Displays:
    1. Hero: YOUR LUCK COULD PUT YOU ON TOP.
    2. Statistics: Total Visitors, Total Entries, Profile Clicks
    3. Live Round: Round #, Countdown, Progress Bar
    4. Enter This Round: ₹49/entry with Razorpay
    5. Current Entries: Compact participant list
    6. Featured Winners: 🏆 TOP 3 WINNERS (Gold, Silver, Bronze)
    """
    session = db_session()
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    track_visitor(session, client_ip)

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    glass_entries = get_glass_box_entries(session, current_round.id, Config.GLASS_BOX_SAMPLE_SIZE)
    latest_completed = get_latest_completed_round(session)
    stats = get_site_statistics(session)

    # Count paid entries in the current round
    active_paid_entries_count = (
        session.query(Entry)
        .join(Payment, Entry.id == Payment.entry_id)
        .filter(
            Entry.round_id == current_round.id,
            Entry.status == "eligible",
            Payment.status == "paid"
        )
        .count()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))
    elapsed_seconds = max(0, Config.ROUND_DURATION_SECONDS - remaining_seconds)
    progress_percent = min(100.0, max(0.0, (elapsed_seconds / float(Config.ROUND_DURATION_SECONDS)) * 100.0))

    return render_template(
        "index.html",
        current_round=current_round,
        glass_entries=glass_entries,
        latest_completed=latest_completed,
        active_entries_count=active_paid_entries_count,
        remaining_seconds=remaining_seconds,
        progress_percent=round(progress_percent, 1),
        stats=stats,
        entry_fee_inr=Config.ENTRY_FEE_INR,
        razorpay_key_id=Config.RAZORPAY_KEY_ID,
        allowed_platforms=ALLOWED_PLATFORMS
    )

@main_bp.route("/entry/create-order", methods=["POST"])
def create_order():
    """
    Step 1 of Payment Flow:
    Validates entry info, creates a Razorpay order, records initial Payment in DB.
    """
    session = db_session()
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()

    if is_submission_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Too many requests. Please wait a moment and try again."
        }), 429

    data = request.get_json(silent=True) or request.form
    display_name = (data.get("display_name") or "").strip()
    platform = (data.get("platform") or "").strip().lower()
    profile_url = (data.get("profile_url") or "").strip()

    # Normalize url scheme if missing and strip trailing slash
    if profile_url and not (profile_url.startswith("http://") or profile_url.startswith("https://")):
        profile_url = "https://" + profile_url
    if profile_url:
        profile_url = profile_url.rstrip("/")

    # Validation
    errors = []
    if not display_name or len(display_name) < 2 or len(display_name) > 60:
        errors.append("Display name must be between 2 and 60 characters.")
    if platform not in ALLOWED_PLATFORMS:
        platform = "website"
    if not validate_profile_url(profile_url):
        errors.append("Please enter a valid public profile or website URL.")

    if errors:
        return jsonify({"success": False, "errors": errors, "error": errors[0]}), 400

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)

    # Check for duplicate paid entry in the same round with identical profile URL
    existing_entry = (
        session.query(Entry)
        .join(Payment, Entry.id == Payment.entry_id)
        .filter(
            Entry.round_id == current_round.id,
            Entry.profile_url == profile_url,
            Payment.status == "paid"
        )
        .first()
    )
    if existing_entry:
        return jsonify({
            "success": False,
            "error": f"This profile is already entered in Round #{current_round.id}!"
        }), 400

    fee_inr = float(current_app.config.get("ENTRY_FEE_INR", Config.ENTRY_FEE_INR))
    amount_paise = int(round(fee_inr * 100))
    key_id = current_app.config.get("RAZORPAY_KEY_ID", Config.RAZORPAY_KEY_ID)
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET", Config.RAZORPAY_KEY_SECRET)
    order_id = None

    # Call Razorpay API if live/test keys are configured (and not mock/testing)
    if (
        key_id 
        and not key_id.startswith("rzp_test_placeholder") 
        and key_secret 
        and key_secret != "placeholder_secret"
        and not current_app.config.get("TESTING")
    ):
        try:
            auth_str = f"{key_id}:{key_secret}"
            b64_auth = base64.b64encode(auth_str.encode()).decode()
            payload = json.dumps({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"rcpt_{int(time.time())}_{uuid.uuid4().hex[:6]}",
                "notes": {
                    "display_name": display_name,
                    "platform": platform,
                    "round_id": str(current_round.id)
                }
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
                resp_json = json.loads(resp.read().decode())
                order_id = resp_json.get("id")
        except Exception as e:
            current_app.logger.warning(f"Razorpay order API call exception: {e}")

    # Fallback order id generation for test/local development environments
    if not order_id:
        order_id = f"order_{int(time.time())}_{uuid.uuid4().hex[:10]}"

    # Save initial payment record with status='created'
    payment = Payment(
        provider="razorpay",
        order_id=order_id,
        amount=fee_inr,
        currency="INR",
        status="created",
        created_at=get_utc_now()
    )
    session.add(payment)
    session.commit()

    return jsonify({
        "success": True,
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "key_id": key_id,
        "fee_inr": fee_inr,
        "display_name": display_name,
        "platform": platform,
        "profile_url": profile_url,
        "round_id": current_round.id
    }), 200

@main_bp.route("/entry/verify-payment", methods=["POST"])
def verify_payment():
    """
    Step 2 of Payment Flow:
    Server-side Razorpay signature verification.
    ONLY upon valid signature:
    - mark payment as 'paid'
    - create active Entry
    - link entry to payment and current round
    """
    session = db_session()
    data = request.get_json(silent=True) or request.form

    order_id = (data.get("razorpay_order_id") or "").strip()
    payment_id = (data.get("razorpay_payment_id") or "").strip()
    signature = (data.get("razorpay_signature") or "").strip()
    display_name = (data.get("display_name") or "").strip()
    platform = (data.get("platform") or "").strip().lower()
    profile_url = (data.get("profile_url") or "").strip()

    if not order_id or not payment_id or not signature:
        return jsonify({
            "success": False,
            "error": "Missing payment verification parameters."
        }), 400

    # Server-side Razorpay HMAC-SHA256 signature verification
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET", Config.RAZORPAY_KEY_SECRET)
    fee_inr = float(current_app.config.get("ENTRY_FEE_INR", Config.ENTRY_FEE_INR))
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    expected_sig = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        # Signature mismatch — update payment status if found
        payment = session.query(Payment).filter_by(order_id=order_id).first()
        if payment:
            payment.status = "failed"
            session.commit()
        return jsonify({
            "success": False,
            "error": "Payment signature verification failed. Active entry was not created."
        }), 400

    # Ensure valid inputs
    if not display_name or len(display_name) < 2 or len(display_name) > 60:
        return jsonify({"success": False, "error": "Invalid display name."}), 400
    if platform not in ALLOWED_PLATFORMS:
        platform = "website"
    if not validate_profile_url(profile_url):
        return jsonify({"success": False, "error": "Invalid profile URL."}), 400

    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)

    # Check for existing payment
    payment = session.query(Payment).filter_by(order_id=order_id).first()
    if not payment:
        payment = Payment(
            provider="razorpay",
            order_id=order_id,
            amount=fee_inr,
            currency="INR",
            status="created",
            created_at=get_utc_now()
        )
        session.add(payment)

    # If already paid and entry exists, idempotent response
    if payment.status == "paid" and payment.entry_id:
        existing_entry = session.query(Entry).filter_by(id=payment.entry_id).first()
        if existing_entry:
            return jsonify({
                "success": True,
                "message": f"Payment already confirmed! You are in Round #{existing_entry.round_id}.",
                "round_id": existing_entry.round_id,
                "entry": existing_entry.to_dict()
            }), 200

    # Create active Entry
    now = get_utc_now()
    new_entry = Entry(
        round_id=current_round.id,
        display_name=display_name,
        platform=platform,
        profile_url=profile_url,
        status="eligible",
        created_at=now
    )
    session.add(new_entry)
    session.flush()

    # Link entry to payment and finalize payment status
    payment.entry_id = new_entry.id
    payment.transaction_id = payment_id
    payment.status = "paid"
    session.commit()

    return jsonify({
        "success": True,
        "message": f"Payment verified! You are entered into Round #{current_round.id}.",
        "round_id": current_round.id,
        "entry": new_entry.to_dict()
    }), 201

@main_bp.route("/entry/payment-failed", methods=["POST"])
def payment_failed():
    """Records payment failure or modal dismissal so unpaid entries are never created."""
    session = db_session()
    data = request.get_json(silent=True) or request.form
    order_id = (data.get("order_id") or data.get("razorpay_order_id") or "").strip()

    if order_id:
        payment = session.query(Payment).filter_by(order_id=order_id).first()
        if payment and payment.status != "paid":
            payment.status = "failed"
            session.commit()

    return jsonify({"success": True, "message": "Payment failure recorded."}), 200

@main_bp.route("/profile/<int:winner_id>/visit")
def visit_profile(winner_id: int):
    """
    Profile click tracking endpoint.
    Increments Winner.clicks in the database and redirects to the creator's profile URL.
    """
    session = db_session()
    winner = session.query(Winner).filter_by(id=winner_id).first()

    if not winner or not winner.entry:
        return redirect(url_for("main.index"))

    winner.clicks = (winner.clicks or 0) + 1
    session.commit()

    target_url = winner.entry.profile_url
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        target_url = "https://" + target_url

    return redirect(target_url, code=302)

@main_bp.route("/api/round-status")
def round_status():
    """
    JSON API for the frontend countdown, progress bar, and live visual updates.
    Automatically checks and rolls the round when end_time is reached.
    """
    session = db_session()
    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    glass_entries = get_glass_box_entries(session, current_round.id, Config.GLASS_BOX_SAMPLE_SIZE)
    latest_completed = get_latest_completed_round(session)
    stats = get_site_statistics(session)

    active_paid_entries_count = (
        session.query(Entry)
        .join(Payment, Entry.id == Payment.entry_id)
        .filter(
            Entry.round_id == current_round.id,
            Entry.status == "eligible",
            Payment.status == "paid"
        )
        .count()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))
    elapsed_seconds = max(0, Config.ROUND_DURATION_SECONDS - remaining_seconds)
    progress_percent = min(100.0, max(0.0, (elapsed_seconds / float(Config.ROUND_DURATION_SECONDS)) * 100.0))

    latest_winners_data = []
    if latest_completed and latest_completed.winners:
        latest_winners_data = [w.to_dict() for w in latest_completed.winners]

    return jsonify({
        "round_id": current_round.id,
        "start_time": current_round.start_time.isoformat(),
        "end_time": current_round.end_time.isoformat(),
        "remaining_seconds": remaining_seconds,
        "progress_percent": round(progress_percent, 1),
        "entries_count": active_paid_entries_count,
        "glass_box_entries": glass_entries,
        "latest_completed_round_id": latest_completed.id if latest_completed else None,
        "latest_winners": latest_winners_data,
        "stats": stats
    })

@main_bp.route("/winners")
def winners():
    """
    Archive of past winners.
    Permanently displays all historical completed rounds and their Gold, Silver, Bronze winners
    along with views and clicks.
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
    """About page detailing product philosophy, hourly engine, and creator discovery."""
    return render_template("about.html")

@main_bp.route("/rules")
def rules():
    """Official rules and transparency page explaining the random draw mechanism."""
    return render_template("rules.html", entry_fee_inr=Config.ENTRY_FEE_INR)

@main_bp.route("/terms")
def terms():
    """Terms and conditions page."""
    return render_template("terms.html")

@main_bp.route("/privacy")
def privacy():
    """Privacy policy explaining data handling and privacy-preserving visitor counting."""
    return render_template("privacy.html")

@main_bp.route("/refunds")
def refunds():
    """Refund policy for paid entries."""
    return render_template("refunds.html")

@main_bp.route("/health")
@main_bp.route("/api/health")
def health():
    """Render health check endpoint."""
    return jsonify({"status": "ok", "service": "indobid.lol"}), 200
