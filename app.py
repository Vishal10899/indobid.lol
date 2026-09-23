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

    # Initialize Database & Admin
    with app.app_context():
        init_db(app)

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
        return {
            "current_year": datetime.now(timezone.utc).year,
            "site_name": "indobid.lol"
        }

    return app

# WSGI application instance for Gunicorn / Render
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Local development server
    app.run(host="0.0.0.0", port=port, debug=True)
