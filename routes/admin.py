import time
import random
from collections import defaultdict
from functools import wraps
from flask import (
    Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
)
from sqlalchemy import func
from database import db_session
from models import AdminUser, Round, Entry, Winner, Payment, SiteVisitor, get_utc_now, ensure_utc
from engine import get_current_round, sync_rounds, get_glass_box_entries
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
    """Admin control center for monitoring rounds, payments, and site statistics."""
    db = db_session()
    current_round = get_current_round(db, Config.ROUND_DURATION_SECONDS)
    
    # Active round entries
    active_entries = (
        db.query(Entry)
        .filter_by(round_id=current_round.id)
        .order_by(Entry.id.desc())
        .all()
    )

    # Real metrics from database
    total_rounds_count = db.query(Round).count()
    total_completed_rounds = db.query(Round).filter_by(status="completed").count()
    total_entries_count = db.query(Entry).count()
    total_paid_entries = db.query(Payment).filter_by(status="paid").count()
    total_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(Payment.status == "paid").scalar() or 0.0
    total_visitors_count = db.query(SiteVisitor).count()
    total_profile_clicks = db.query(func.coalesce(func.sum(Winner.clicks), 0)).scalar() or 0
    total_winners_count = db.query(Winner).count()

    # Recent payments
    recent_payments = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .limit(15)
        .all()
    )

    # Past rounds
    past_rounds = (
        db.query(Round)
        .filter_by(status="completed")
        .order_by(Round.id.desc())
        .limit(10)
        .all()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))

    return render_template(
        "admin/dashboard.html",
        current_round=current_round,
        active_entries=active_entries,
        total_rounds_count=total_rounds_count,
        total_completed_rounds=total_completed_rounds,
        total_entries_count=total_entries_count,
        total_paid_entries=total_paid_entries,
        total_revenue=float(total_revenue),
        total_visitors_count=total_visitors_count,
        total_profile_clicks=int(total_profile_clicks),
        total_winners_count=total_winners_count,
        recent_payments=recent_payments,
        past_rounds=past_rounds,
        remaining_seconds=remaining_seconds,
        is_production=Config.IS_PRODUCTION
    )

@admin_bp.route("/trigger-draw", methods=["POST"])
@admin_required
def trigger_draw():
    """
    Admin manual trigger to close the active round and draw winners.
    Strictly calls the same authoritative sync_rounds() engine.
    Never allows manually selecting winners.
    """
    db = db_session()
    current_round = get_current_round(db, Config.ROUND_DURATION_SECONDS)

    try:
        completed = sync_rounds(db, duration_seconds=Config.ROUND_DURATION_SECONDS, force_close_id=current_round.id)
        if completed:
            flash(f"Round #{current_round.id} completed! Winners have been selected.", "success")
        else:
            flash(f"Could not complete Round #{current_round.id}.", "warning")
    except Exception as e:
        flash(f"Draw failed: {str(e)}", "error")

    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/seed-entries", methods=["POST"])
@admin_required
def seed_entries():
    """Adds sample paid creator profiles into the current active round for development demo. Disabled in production."""
    if Config.IS_PRODUCTION:
        flash("Seeding test entries is strictly disabled in production.", "error")
        return redirect(url_for("admin.dashboard"))

    sample_profiles = [
        ("Vishal Kumar", "twitter", "https://x.com/vishalkumar"),
        ("Sarah Jenkins", "youtube", "https://youtube.com/@sarahbuilds"),
        ("Alex Rivera", "github", "https://github.com/alexrivera"),
        ("Daniel Wu", "tiktok", "https://tiktok.com/@danielcreates"),
        ("Elena Rostova", "instagram", "https://instagram.com/elenarostova"),
        ("Marcus Vance", "website", "https://marcusvance.design"),
        ("Chloe Bennett", "twitter", "https://x.com/chloebenn"),
        ("Liam Patel", "linkedin", "https://linkedin.com/in/liampatel"),
        ("Aria Stark", "github", "https://github.com/ariastark"),
        ("Neo Anderson", "website", "https://neoanderson.dev")
    ]

    db = db_session()
    current_round = get_current_round(db, Config.ROUND_DURATION_SECONDS)

    added_count = 0
    now = get_utc_now()
    for name, platform, url in sample_profiles:
        exists = db.query(Entry).filter_by(round_id=current_round.id, profile_url=url).first()
        if not exists:
            entry = Entry(
                round_id=current_round.id,
                display_name=name,
                platform=platform,
                profile_url=url,
                status="eligible",
                created_at=now
            )
            db.add(entry)
            db.flush()

            payment = Payment(
                entry_id=entry.id,
                provider="razorpay",
                order_id=f"order_demo_{int(time.time())}_{added_count}",
                transaction_id=f"pay_demo_{int(time.time())}_{added_count}",
                amount=Config.ENTRY_FEE_INR,
                currency="INR",
                status="paid",
                created_at=now
            )
            db.add(payment)
            added_count += 1

    db.commit()
    flash(f"Successfully added {added_count} sample paid entries to Round #{current_round.id}!", "success")
    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/entries/<int:entry_id>/reject", methods=["POST"])
@admin_required
def reject_entry(entry_id):
    """Marks an entry as rejected/ineligible."""
    db = db_session()
    entry = db.query(Entry).filter_by(id=entry_id).first()
    if entry:
        entry.status = "rejected"
        db.commit()
        flash(f"Entry '{entry.display_name}' has been disqualified.", "info")
    else:
        flash("Entry not found.", "error")
    return redirect(url_for("admin.dashboard"))
