import time
from collections import defaultdict
from functools import wraps
from flask import (
    Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
)
from sqlalchemy import func, desc
from database import db_session
from models import AdminUser, Round, Listing, Entry, Winner, Payment, SiteVisitor, SiteSetting, get_utc_now, ensure_utc
from engine import get_current_round, sync_rounds, get_current_listings
from config import Config

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

# Failed login attempt tracking: IP -> list of timestamps
_failed_admin_logins: dict[str, list[float]] = defaultdict(list)
_MAX_FAILED_LOGIN_ATTEMPTS = 5

def is_admin_login_locked(ip_address: str) -> bool:
    """Blocks IP after 5 consecutive failed login attempts within 5 minutes."""
    from flask import current_app
    try:
        if current_app and current_app.config.get("TESTING"):
            return False
    except Exception:
        pass

    now = time.time()
    window = now - 300.0
    attempts = [t for t in _failed_admin_logins[ip_address] if t > window]
    _failed_admin_logins[ip_address] = attempts
    return len(attempts) >= _MAX_FAILED_LOGIN_ATTEMPTS

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("admin_id"):
            flash("Administrator login required.", "warning")
            return redirect(url_for("admin.login"))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route("/login", methods=["GET", "POST"])
def login():
    """Admin login page. Standard users never see this."""
    if session.get("admin_id"):
        return redirect(url_for("admin.dashboard"))

    if request.method == "POST":
        client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
        if is_admin_login_locked(client_ip):
            flash("Too many failed login attempts. Please wait 5 minutes before trying again.", "error")
            return render_template("admin/login.html")

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        db = db_session()
        admin = db.query(AdminUser).filter_by(email=email).first()

        if admin and admin.check_password(password):
            _failed_admin_logins.pop(client_ip, None)
            session["admin_id"] = admin.id
            session["admin_email"] = admin.email
            flash("Welcome to the IndoBid Control Center.", "success")
            return redirect(url_for("admin.dashboard"))
        else:
            _failed_admin_logins[client_ip].append(time.time())
            flash("Invalid administrator credentials.", "error")

    return render_template("admin/login.html")

@admin_bp.route("/logout")
def logout():
    """Logs out the administrator."""
    session.clear()
    flash("Successfully signed out.", "info")
    return redirect(url_for("admin.login"))

@admin_bp.route("/")
@admin_bp.route("/dashboard")
@admin_required
def dashboard():
    """
    Admin control center providing:
    - Overview (Total Listings, Payments, Revenue, Visitors, Clicks)
    - Current Round (Round #, Start, End, Remaining, Listings)
    - Listings table (all listings, clicks, payment status, disqualify action)
    - Payments table (Payment ID, Listing, Amount, Currency, Status, Date)
    - Winners table (all historical winners)
    - Settings (Listing price, currency, colors, copy, Razorpay settings)
    """
    db = db_session()
    current_round = get_current_round(db, Config.ROUND_DURATION_SECONDS)
    settings = SiteSetting.get_settings(db)

    # Active round listings
    active_listings = get_current_listings(db, current_round.id)

    # Overview Metrics from real database (enforcing verified paid status)
    total_listings_count = db.query(Listing).count()
    total_paid_listings = (
        db.query(Listing)
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(Payment.status == "paid")
        .count()
    )
    total_payments_count = db.query(Payment).count()
    total_successful_payments = db.query(Payment).filter(Payment.status == "paid").count()
    total_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(Payment.status == "paid").scalar() or 0.0
    total_visitors_count = db.query(SiteVisitor).count()
    total_link_clicks = (
        db.query(func.coalesce(func.sum(Listing.click_count), 0))
        .join(Payment, Listing.id == Payment.listing_id)
        .filter(Payment.status == "paid")
        .scalar() or 0
    )
    total_completed_rounds = db.query(Round).filter_by(status="completed").count()

    # All Listings (most recent 50)
    all_listings = (
        db.query(Listing)
        .order_by(Listing.id.desc())
        .limit(50)
        .all()
    )

    # Recent Payments (most recent 30)
    recent_payments = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .limit(30)
        .all()
    )

    # All Winners (most recent 30)
    all_winners = (
        db.query(Winner)
        .order_by(Winner.id.desc())
        .limit(30)
        .all()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))

    return render_template(
        "admin/dashboard.html",
        current_round=current_round,
        active_entries=active_listings,
        active_listings=active_listings,
        total_listings_count=total_listings_count,
        total_paid_listings=total_paid_listings,
        total_payments_count=total_payments_count,
        total_successful_payments=total_successful_payments,
        total_revenue=float(total_revenue),
        total_visitors_count=total_visitors_count,
        total_link_clicks=int(total_link_clicks),
        total_profile_clicks=int(total_link_clicks),
        total_completed_rounds=total_completed_rounds,
        all_listings=all_listings,
        recent_payments=recent_payments,
        all_winners=all_winners,
        settings=settings,
        remaining_seconds=remaining_seconds,
        is_production=Config.IS_PRODUCTION
    )

@admin_bp.route("/settings", methods=["POST"])
@admin_required
def update_settings():
    """Updates customizable platform settings."""
    db = db_session()
    settings = SiteSetting.get_settings(db)

    try:
        price = float(request.form.get("listing_price", settings.listing_price))
        if price > 0:
            settings.listing_price = price
    except ValueError:
        flash("Invalid listing price.", "error")
        return redirect(url_for("admin.dashboard") + "#settings")

    currency = request.form.get("currency", settings.currency).strip().upper()
    if currency:
        settings.currency = currency

    site_name = request.form.get("site_name", settings.site_name).strip()
    if site_name:
        settings.site_name = site_name

    site_logo = request.form.get("site_logo", "").strip()
    settings.site_logo = site_logo

    primary_color = request.form.get("primary_color", settings.primary_color).strip()
    if primary_color:
        settings.primary_color = primary_color

    secondary_color = request.form.get("secondary_color", settings.secondary_color).strip()
    if secondary_color:
        settings.secondary_color = secondary_color

    background_color = request.form.get("background_color", settings.background_color).strip()
    if background_color:
        settings.background_color = background_color

    button_color = request.form.get("button_color", settings.button_color).strip()
    if button_color:
        settings.button_color = button_color

    hero_heading = request.form.get("hero_heading", settings.hero_heading).strip()
    if hero_heading:
        settings.hero_heading = hero_heading

    hero_description = request.form.get("hero_description", settings.hero_description).strip()
    if hero_description:
        settings.hero_description = hero_description

    homepage_text = request.form.get("homepage_text", settings.homepage_text).strip()
    if homepage_text:
        settings.homepage_text = homepage_text

    razorpay_key_id = request.form.get("razorpay_key_id", "").strip()
    if razorpay_key_id:
        settings.razorpay_key_id = razorpay_key_id

    razorpay_key_secret = request.form.get("razorpay_key_secret", "").strip()
    if razorpay_key_secret and razorpay_key_secret != "••••••••":
        settings.razorpay_key_secret = razorpay_key_secret

    settings.updated_at = get_utc_now()
    db.commit()

    flash("Platform settings saved successfully!", "success")
    return redirect(url_for("admin.dashboard") + "#settings")

@admin_bp.route("/trigger-draw", methods=["POST"])
@admin_required
def trigger_draw():
    """
    Admin manual trigger to close the active round and draw winners.
    Strictly calls authoritative sync_rounds() engine.
    """
    db = db_session()
    current_round = get_current_round(db, Config.ROUND_DURATION_SECONDS)

    try:
        completed = sync_rounds(db, duration_seconds=Config.ROUND_DURATION_SECONDS, force_close_id=current_round.id)
        if completed:
            flash(f"Round #{current_round.id} completed! 3 winners randomly selected.", "success")
        else:
            flash(f"Could not complete Round #{current_round.id}.", "warning")
    except Exception as e:
        flash(f"Draw failed: {str(e)}", "error")

    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/listings/<int:listing_id>/reject", methods=["POST"])
@admin_bp.route("/entries/<int:entry_id>/reject", methods=["POST"])
@admin_required
def reject_entry(listing_id=None, entry_id=None):
    """Marks a listing as rejected/disqualified."""
    target_id = listing_id or entry_id
    db = db_session()
    listing = db.query(Listing).filter_by(id=target_id).first()
    if listing:
        listing.status = "rejected"
        db.commit()
        flash(f"Listing '{listing.username}' has been disqualified.", "info")
    else:
        flash("Listing not found.", "error")
    return redirect(url_for("admin.dashboard"))
