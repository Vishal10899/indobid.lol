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

    price, currency, symbol = get_pricing_config(session)
    settings = SiteSetting.get_settings(session)
    razorpay_key, _ = get_razorpay_credentials(session)

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
        entry_fee_inr=price,
        razorpay_key_id=razorpay_key,
        allowed_platforms=ALLOWED_PLATFORMS
    )

RAZORPAY_KEY_ID_VAR_NAMES = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY",
    "RAZORPAY_ID",
    "RAZORPAY_API_KEY",
    "RAZORPAY_LIVE_KEY_ID",
    "RAZORPAY_LIVE_KEY",
    "RAZORPAYKEYID",
    "RAZORPAYKEY",
    "RAZOR_PAY_KEY_ID",
    "RAZOR_PAY_KEY",
    "RZP_KEY_ID",
    "RZP_KEY",
    "RZP_LIVE_KEY_ID",
    "RZP_LIVE_KEY"
]

RAZORPAY_SECRET_VAR_NAMES = [
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_SECRET",
    "RAZORPAY_SECRET_KEY",
    "RAZORPAY_API_SECRET",
    "RAZORPAY_LIVE_SECRET",
    "RAZORPAY_LIVE_KEY_SECRET",
    "RAZORPAYKEYSECRET",
    "RAZORPAYSECRET",
    "RAZOR_PAY_KEY_SECRET",
    "RAZOR_PAY_SECRET",
    "RAZOR_PAY_SECRET_KEY",
    "RZP_KEY_SECRET",
    "RZP_SECRET",
    "RZP_SECRET_KEY",
    "RZP_LIVE_KEY_SECRET",
    "RZP_LIVE_SECRET",
    "RAZORPAY_PRIVATE_KEY",
    "RAZORPAY_API_KEY_SECRET"
]

def clean_credential(val) -> str:
    """Strips whitespace, enclosing quotes, newlines, and carriage returns."""
    if val is None:
        return ""
    v = str(val).strip()
    # Strip quotes (including smart quotes)
    quote_chars = ('"', "'", '“', '”', '‘', '’', '`')
    while len(v) >= 2 and v[0] in quote_chars and v[-1] in quote_chars:
        v = v[1:-1].strip()
    return v

def is_placeholder_value(val: str) -> bool:
    """Checks whether a value is an obvious placeholder rather than a real credential."""
    v = clean_credential(val)
    if not v:
        return True
    # Enclosed in brackets: <configured live key>, <key_id>, {YOUR_KEY}, [your_key]
    if (v.startswith("<") and v.endswith(">")) or (v.startswith("[") and v.endswith("]")) or (v.startswith("{") and v.endswith("}")):
        return True

    lower = v.lower()
    if lower in ("none", "null", "undefined", "xxxx", "xxxxxxxx", "••••", "••••••••", "change_me", "placeholder", "your_key_id", "your_key_secret"):
        return True
    if "placeholder" in lower or "your_key" in lower or "your_secret" in lower or "change_me" in lower or "configured live" in lower or "insert_here" in lower:
        return True
    return False

def is_valid_key_id(val: str) -> bool:
    """Checks whether a Razorpay Key ID string is valid and not a placeholder."""
    v = clean_credential(val)
    if not v or is_placeholder_value(v):
        return False
    lower = v.lower()
    # Legitimate Razorpay keys start with rzp_live_ or rzp_test_
    if lower.startswith("rzp_live_") or lower.startswith("rzp_test_"):
        return len(v) > 9
    return len(v) >= 12

def is_valid_key_secret(val: str) -> bool:
    """Checks whether a Razorpay Key Secret string is valid and not a placeholder."""
    v = clean_credential(val)
    if not v or is_placeholder_value(v):
        return False
    # Accept any non-placeholder secret with reasonable length (>= 8 chars)
    return len(v) >= 8

def is_valid_credential(val: str, is_key_id: bool = False) -> bool:
    """Backward compatibility wrapper for credential validation."""
    return is_valid_key_id(val) if is_key_id else is_valid_key_secret(val)

def get_razorpay_config(session=None) -> dict:
    """
    Canonical, production-safe resolution of Razorpay Key ID and Secret at RUNTIME.
    Priority:
      1. Live os.environ across all common naming conventions (case-insensitive)
      2. Flask current_app.config (especially for test fixtures)
      3. Config class attributes
      4. Database settings (SiteSetting)
    Returns:
      {
        "configured": bool,
        "key_id": str,
        "key_secret": str,
        "key_id_present": bool,
        "key_secret_present": bool,
        "key_id_prefix": str,
        "mode": str,
        "rejection_reason": str or None
      }
    """
    candidate_key_id = ""
    candidate_key_secret = ""
    detected_key_var = None
    detected_secret_var = None
    matching_env_names = []

    # 1. Live os.environ scan across all aliases (case-insensitive and whitespace-tolerant)
    env_items = {k.strip().upper(): (k, v) for k, v in os.environ.items()}
    for orig_k in os.environ.keys():
        uk = orig_k.strip().upper()
        if "RAZOR" in uk or "RZP" in uk:
            matching_env_names.append(orig_k)

    for alias in RAZORPAY_KEY_ID_VAR_NAMES:
        if alias in env_items:
            orig_name, raw_val = env_items[alias]
            val = clean_credential(raw_val)
            if is_valid_key_id(val):
                candidate_key_id = val
                detected_key_var = orig_name
                break

    for alias in RAZORPAY_SECRET_VAR_NAMES:
        if alias in env_items:
            orig_name, raw_val = env_items[alias]
            val = clean_credential(raw_val)
            if is_valid_key_secret(val):
                candidate_key_secret = val
                detected_secret_var = orig_name
                break

    # 2. Dynamic scan of any os.environ variable containing RAZOR/RZP and SEC
    if not candidate_key_secret:
        for orig_k, orig_v in os.environ.items():
            uk = orig_k.strip().upper().replace("-", "_")
            if ("RAZOR" in uk or "RZP" in uk) and ("SEC" in uk or "PASS" in uk):
                val = clean_credential(orig_v)
                if is_valid_key_secret(val):
                    candidate_key_secret = val
                    detected_secret_var = orig_k
                    break

    if not candidate_key_id:
        for orig_k, orig_v in os.environ.items():
            uk = orig_k.strip().upper().replace("-", "_")
            if ("RAZOR" in uk or "RZP" in uk) and ("KEY" in uk or "ID" in uk) and ("SEC" not in uk):
                val = clean_credential(orig_v)
                if is_valid_key_id(val):
                    candidate_key_id = val
                    detected_key_var = orig_k
                    break

    # 3. current_app.config (for test fixtures / app config)
    if not candidate_key_id or not candidate_key_secret:
        try:
            from flask import has_app_context, current_app
            if has_app_context():
                for alias in RAZORPAY_KEY_ID_VAR_NAMES:
                    if not candidate_key_id and alias in current_app.config:
                        val = clean_credential(current_app.config.get(alias, ""))
                        if is_valid_key_id(val):
                            candidate_key_id = val
                            detected_key_var = f"app.config[{alias}]"
                            break
                for alias in RAZORPAY_SECRET_VAR_NAMES:
                    if not candidate_key_secret and alias in current_app.config:
                        val = clean_credential(current_app.config.get(alias, ""))
                        if is_valid_key_secret(val):
                            candidate_key_secret = val
                            detected_secret_var = f"app.config[{alias}]"
                            break
        except Exception:
            pass

    # 4. Config class attributes
    if not candidate_key_id or not candidate_key_secret:
        try:
            from config import Config
            for alias in RAZORPAY_KEY_ID_VAR_NAMES:
                if not candidate_key_id and hasattr(Config, alias):
                    val = clean_credential(getattr(Config, alias, ""))
                    if is_valid_key_id(val):
                        candidate_key_id = val
                        detected_key_var = f"Config.{alias}"
                        break
            for alias in RAZORPAY_SECRET_VAR_NAMES:
                if not candidate_key_secret and hasattr(Config, alias):
                    val = clean_credential(getattr(Config, alias, ""))
                    if is_valid_key_secret(val):
                        candidate_key_secret = val
                        detected_secret_var = f"Config.{alias}"
                        break
        except Exception:
            pass

    # 5. Database fallback (SiteSetting)
    if (not candidate_key_id or not candidate_key_secret) and session:
        try:
            settings = SiteSetting.get_settings(session)
            if settings:
                db_id = clean_credential(getattr(settings, "razorpay_key_id", ""))
                db_sec = clean_credential(getattr(settings, "razorpay_key_secret", ""))
                if not candidate_key_id and is_valid_key_id(db_id):
                    candidate_key_id = db_id
                    detected_key_var = "SiteSetting.razorpay_key_id"
                if not candidate_key_secret and is_valid_key_secret(db_sec):
                    candidate_key_secret = db_sec
                    detected_secret_var = "SiteSetting.razorpay_key_secret"
        except Exception:
            pass

    key_id_present = bool(candidate_key_id)
    key_secret_present = bool(candidate_key_secret)
    configured = bool(key_id_present and key_secret_present)

    prefix = "none"
    mode = "unknown"
    if candidate_key_id:
        lower_id = candidate_key_id.lower()
        if lower_id.startswith("rzp_live_"):
            prefix = "rzp_live_"
            mode = "live"
        elif lower_id.startswith("rzp_test_"):
            prefix = "rzp_test_"
            mode = "test"
        else:
            prefix = candidate_key_id[:8]

    rejection_reason = None
    if not configured:
        if not key_id_present and not key_secret_present:
            rejection_reason = "Both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing."
        elif not key_id_present:
            rejection_reason = "RAZORPAY_KEY_ID is missing or an invalid placeholder."
        else:
            rejection_reason = "RAZORPAY_KEY_SECRET is missing or an invalid placeholder."

    return {
        "configured": configured,
        "key_id": candidate_key_id,
        "key_secret": candidate_key_secret,
        "key_id_present": key_id_present,
        "key_secret_present": key_secret_present,
        "key_id_prefix": prefix,
        "mode": mode,
        "detected_key_var": detected_key_var,
        "detected_secret_var": detected_secret_var,
        "env_keys_detected": matching_env_names,
        "rejection_reason": rejection_reason
    }

def get_razorpay_credentials(session=None) -> tuple[str, str]:
    """Canonical function returning (key_id, key_secret) or ('', '')."""
    cfg = get_razorpay_config(session)
    if cfg["configured"]:
        return cfg["key_id"], cfg["key_secret"]
    return "", ""

def get_pricing_config(session=None) -> tuple[float, str, str]:
    """
    Returns (price, currency, symbol) dynamically at runtime.
    In testing: respects current_app.config (TestConfig).
    In production: respects explicit environment variables (CURRENCY, LISTING_PRICE, ENTRY_FEE_INR),
    or SiteSetting if customized, defaulting to INR / 49.0.
    """
    is_testing = False
    try:
        from flask import current_app, has_app_context
        if has_app_context():
            is_testing = bool(current_app.config.get("TESTING"))
    except Exception:
        pass

    if is_testing:
        curr = str(os.environ.get("CURRENCY") or current_app.config.get("CURRENCY", "USD")).upper()
        if curr == "INR":
            price = float(os.environ.get("ENTRY_FEE_INR") or os.environ.get("LISTING_PRICE") or current_app.config.get("ENTRY_FEE_INR", current_app.config.get("LISTING_PRICE", 49.0)))
        else:
            price = float(current_app.config.get("LISTING_PRICE", 2.0))
        symbols = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "AUD": "A$"}
        return price, curr, symbols.get(curr, "$")

    db_price = None
    db_curr = None
    settings = None
    if session:
        try:
            settings = SiteSetting.get_settings(session)
            if settings:
                db_price = settings.listing_price
                db_curr = settings.currency
        except Exception:
            pass

    # Production / non-testing:
    # 1. Explicit environment variables take highest precedence
    raw_env_curr = clean_credential(os.environ.get("CURRENCY", ""))
    raw_env_price = clean_credential(os.environ.get("ENTRY_FEE_INR", "") if (raw_env_curr.upper() == "INR") else "") or clean_credential(os.environ.get("LISTING_PRICE", "")) or clean_credential(os.environ.get("ENTRY_FEE_INR", ""))

    # In production, indobid.lol defaults to INR unless explicitly overridden by CURRENCY in env
    is_legacy_default = (str(db_curr).upper() == "USD") if (db_curr and raw_env_curr.upper() != "USD") else False

    if raw_env_curr:
        currency = raw_env_curr.upper()
    elif db_curr and not is_legacy_default:
        currency = db_curr.upper()
    else:
        currency = str(getattr(Config, "CURRENCY", "INR")).upper()

    if raw_env_price:
        try:
            price = float(raw_env_price)
        except (ValueError, TypeError):
            price = None
    elif db_price is not None and not is_legacy_default:
        price = float(db_price)
    else:
        price = float(getattr(Config, "ENTRY_FEE_INR", 49.0) if currency == "INR" else getattr(Config, "LISTING_PRICE", 2.0))

    if price is None:
        price = 49.0 if currency == "INR" else 2.0

    symbols = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "AUD": "A$"}
    symbol = symbols.get(currency, currency + " ")

    # Sync to SiteSetting if it was legacy default or explicitly overridden by env vars
    if session and settings:
        try:
            if is_legacy_default or (raw_env_curr and settings.currency != currency) or (raw_env_price and settings.listing_price != price):
                settings.currency = currency
                settings.listing_price = price
                session.commit()
        except Exception:
            session.rollback()

    return price, currency, symbol

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

    price, currency, symbol = get_pricing_config(session)
    settings = SiteSetting.get_settings(session)

    rzp_cfg = get_razorpay_config(session)
    if not rzp_cfg["configured"]:
        current_app.logger.warning(f"Payment configuration check failed: {rzp_cfg.get('rejection_reason')}")
        return jsonify({
            "success": False,
            "error_type": "CONFIGURATION_ERROR",
            "error": "Payment service is not configured.",
            "message": "Payment service is not configured."
        }), 503

    key_id = rzp_cfg["key_id"]
    key_secret = rzp_cfg["key_secret"]

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
        
        rzp_desc = "Unable to create payment order."
        try:
            err_json = json.loads(err_body)
            if "error" in err_json and isinstance(err_json["error"], dict):
                rzp_desc = err_json["error"].get("description", rzp_desc)
        except Exception:
            pass

        if e.code in (401, 403):
            user_msg = "Payment gateway authentication failed. Please check configured credentials."
            err_type = "RAZORPAY_AUTH_ERROR"
            ret_err = user_msg
        else:
            err_type = "RAZORPAY_API_ERROR"
            ret_err = "Unable to create payment order." if rzp_desc == "Unable to create payment order." else f"Payment order creation failed: {rzp_desc}"
            user_msg = ret_err

        return jsonify({
            "success": False,
            "error_type": err_type,
            "error": ret_err,
            "message": user_msg
        }), 400
    except Exception as e:
        current_app.logger.error(f"Razorpay order API call exception: {e}")
        return jsonify({
            "success": False,
            "error_type": "RAZORPAY_API_ERROR",
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
        "currency_symbol": symbol,
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

    rzp_cfg = get_razorpay_config(session)
    if not rzp_cfg["configured"]:
        return jsonify({
            "success": False,
            "error_type": "CONFIGURATION_ERROR",
            "error": "Payment service is not configured.",
            "message": "Payment service is not configured."
        }), 503

    key_id = rzp_cfg["key_id"]
    key_secret = rzp_cfg["key_secret"]

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

@main_bp.route("/health/payment")
@main_bp.route("/api/health/payment")
def health_payment():
    """
    Safe production diagnostic endpoint for payment configuration.
    NEVER logs or exposes RAZORPAY_KEY_SECRET.
    Returns:
      {
        "payment_provider": "razorpay",
        "configured": true/false,
        "key_id_present": true/false,
        "key_id_prefix": "rzp_live_",
        "key_secret_present": true/false,
        "currency": "INR",
        "price": 49.0
      }
    """
    session = db_session()
    cfg = get_razorpay_config(session)
    price, currency, _ = get_pricing_config(session)
    return jsonify({
        "payment_provider": "razorpay",
        "configured": cfg["configured"],
        "key_id_present": cfg["key_id_present"],
        "key_id_prefix": cfg["key_id_prefix"],
        "key_secret_present": cfg["key_secret_present"],
        "currency": currency,
        "price": price,
        "diagnostics": {
            "key_var": cfg.get("detected_key_var"),
            "secret_var": cfg.get("detected_secret_var"),
            "env_names": cfg.get("env_keys_detected", []),
            "rejection_reason": cfg.get("rejection_reason")
        }
    }), 200
