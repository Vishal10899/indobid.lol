import os
from datetime import datetime, timezone
from flask import Flask
from config import Config
from database import init_db, close_db
from routes.main import main_bp
from routes.admin import admin_bp

def create_app(config_class=Config):
    """Application factory for indobid.lol."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize Database & Admin with Safe Startup Diagnostics
    with app.app_context():
        init_db(app)
        try:
            from routes.main import get_razorpay_config, get_pricing_config
            rzp_cfg = get_razorpay_config()
            _, curr, _ = get_pricing_config()
            app.logger.info(
                f"Razorpay startup: configured={rzp_cfg['configured']}, "
                f"mode={rzp_cfg['mode']}, "
                f"key_id_present={rzp_cfg['key_id_present']}, "
                f"key_secret_present={rzp_cfg['key_secret_present']}, "
                f"currency={curr}"
            )
        except Exception as e:
            app.logger.warning(f"Startup diagnostic check error: {e}")

    # Register Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)

    # Session cookie hardening
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    if not app.config.get("TESTING", False):
        if not Config.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
            app.config["SESSION_COOKIE_SECURE"] = True

    # Security HTTP headers
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Error handlers
    @app.errorhandler(404)
    def handle_404(e):
        from flask import request, jsonify, render_template
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "error": "Endpoint not found"}), 404
        return render_template("404.html"), 404

    @app.errorhandler(500)
    def handle_500(e):
        from flask import request, jsonify, render_template
        from database import db_session
        db_session.rollback()
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "error": "Internal server error"}), 500
        return render_template("500.html"), 500

    # Teardown database session
    @app.teardown_appcontext
    def teardown_db(exception=None):
        close_db(exception)

    # Global template context
    @app.context_processor
    def inject_global_data():
        from models import SiteSetting
        from database import db_session
        from routes.main import get_razorpay_config, get_pricing_config
        try:
            sess = db_session()
            settings = SiteSetting.get_settings(sess)
            price, curr, symbol = get_pricing_config(sess)
            rzp_cfg = get_razorpay_config(sess)
        except Exception:
            settings = None
            price, curr, symbol = 49.0, "INR", "₹"
            rzp_cfg = {"configured": False, "key_id": ""}
        return {
            "current_year": datetime.now(timezone.utc).year,
            "site_name": settings.site_name if settings else "indobid.lol",
            "settings": settings,
            "entry_fee_inr": price,
            "razorpay_key_id": rzp_cfg["key_id"] if rzp_cfg["configured"] else "",
            "razorpay_configured": rzp_cfg["configured"]
        }

    return app

# WSGI application instance for Gunicorn / Render
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Local development server
    app.run(host="0.0.0.0", port=port, debug=True)
