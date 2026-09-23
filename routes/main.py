import time
from collections import defaultdict
from urllib.parse import urlparse
from datetime import timezone
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, current_app
from database import db_session
from models import Round, Entry, Winner, get_utc_now, ensure_utc
from engine import get_current_round, get_glass_box_entries, get_latest_completed_round
from config import Config

main_bp = Blueprint("main", __name__)

# Lightweight in-memory rate limiting: IP -> list of submission timestamps
_submission_rate_limit: dict[str, list[float]] = defaultdict(list)
_MAX_SUBMISSIONS_PER_MINUTE = 15

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

@main_bp.route("/")
def index():
    """
    Homepage - almost entirely one screen.
    Displays:
    1. Hero: YOUR LUCK COULD PUT YOU ON TOP.
    2. Glass Box: CURRENT ENTRIES (sampled from DB)
    3. Countdown: NEXT DRAW IN mm:ss
    4. Featured Winners from most recent completed round.
    """
    session = db_session()
    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    glass_entries = get_glass_box_entries(session, current_round.id, Config.GLASS_BOX_SAMPLE_SIZE)
    latest_completed = get_latest_completed_round(session)
    
    total_entries_count = (
        session.query(Entry)
        .filter_by(round_id=current_round.id, status="eligible")
        .count()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))

    return render_template(
        "index.html",
        current_round=current_round,
        glass_entries=glass_entries,
        latest_completed=latest_completed,
        total_entries_count=total_entries_count,
        remaining_seconds=remaining_seconds,
        allowed_platforms=ALLOWED_PLATFORMS
    )

@main_bp.route("/entry/submit", methods=["POST"])
def submit_entry():
    """
    Frictionless entry submission.
    No user account required!
    Accepts:
      - display_name
      - platform
      - profile_url
    Supports both JSON and standard form submission.
    """
    session = db_session()
    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)

    # Support JSON or Form Data
    if request.is_json:
        data = request.get_json() or {}
        display_name = data.get("display_name", "").strip()
        platform = data.get("platform", "").strip().lower()
        profile_url = data.get("profile_url", "").strip()
    else:
        display_name = request.form.get("display_name", "").strip()
        platform = request.form.get("platform", "").strip().lower()
        profile_url = request.form.get("profile_url", "").strip()

    # Rate limit check by IP
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    if is_submission_rate_limited(client_ip):
        msg = "Too many submissions. Please slow down and try again in a moment."
        if request.is_json:
            return jsonify({"success": False, "errors": [msg]}), 429
        flash(msg, "warning")
        return redirect(url_for("main.index"))

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
        errors.append("Please enter a valid public profile or website URL (e.g. https://x.com/username).")

    if errors:
        if request.is_json:
            return jsonify({"success": False, "errors": errors}), 400
        for err in errors:
            flash(err, "error")
        return redirect(url_for("main.index"))

    # Check for duplicate entry in the same round with identical profile URL
    existing = (
        session.query(Entry)
        .filter_by(round_id=current_round.id, profile_url=profile_url)
        .first()
    )
    if existing:
        msg = "This profile is already entered in Round #" + str(current_round.id) + "!"
        if request.is_json:
            return jsonify({"success": True, "already_entered": True, "message": msg, "round_id": current_round.id}), 200
        flash(msg, "info")
        return redirect(url_for("main.index"))

    # Insert entry
    new_entry = Entry(
        round_id=current_round.id,
        display_name=display_name,
        platform=platform,
        profile_url=profile_url,
        status="eligible",
        created_at=get_utc_now()
    )
    session.add(new_entry)
    session.commit()

    success_msg = f"You are entered into Round #{current_round.id}! Keep an eye on the countdown."

    if request.is_json:
        return jsonify({
            "success": True,
            "message": success_msg,
            "round_id": current_round.id,
            "entry": new_entry.to_dict()
        }), 201

    flash(success_msg, "success")
    return redirect(url_for("main.index"))

@main_bp.route("/api/round-status")
def round_status():
    """
    JSON API for the frontend countdown and live visual updates.
    Automatically checks and rolls the round when end_time is reached.
    """
    session = db_session()
    current_round = get_current_round(session, Config.ROUND_DURATION_SECONDS)
    glass_entries = get_glass_box_entries(session, current_round.id, Config.GLASS_BOX_SAMPLE_SIZE)
    latest_completed = get_latest_completed_round(session)

    total_entries_count = (
        session.query(Entry)
        .filter_by(round_id=current_round.id, status="eligible")
        .count()
    )

    now = get_utc_now()
    remaining_seconds = max(0, int((ensure_utc(current_round.end_time) - ensure_utc(now)).total_seconds()))

    latest_winners_data = []
    if latest_completed and latest_completed.winners:
        latest_winners_data = [w.to_dict() for w in latest_completed.winners]

    return jsonify({
        "round_id": current_round.id,
        "start_time": current_round.start_time.isoformat(),
        "end_time": current_round.end_time.isoformat(),
        "remaining_seconds": remaining_seconds,
        "entries_count": total_entries_count,
        "glass_box_entries": glass_entries,
        "latest_completed_round_id": latest_completed.id if latest_completed else None,
        "latest_winners": latest_winners_data
    })

@main_bp.route("/winners")
def winners():
    """
    Archive of past winners.
    Permanently displays all historical completed rounds and their Gold, Silver, Bronze winners.
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
    """About page detailing product philosophy, rules, and hourly engine."""
    return render_template("about.html")

@main_bp.route("/health")
@main_bp.route("/api/health")
def health():
    """Render health check endpoint."""
    return jsonify({"status": "ok", "service": "indobid.lol"}), 200
