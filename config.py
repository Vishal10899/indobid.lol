import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / ".env")

class Config:
    """Base application configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "indobid-secret-key-change-in-production-2026")
    
    # Environment detection
    IS_PRODUCTION = (
        os.getenv("RENDER") == "true"
        or os.getenv("FLASK_ENV") == "production"
        or os.getenv("ENVIRONMENT") == "production"
    )

    raw_db_url = os.getenv("DATABASE_URL", "").strip()

    if IS_PRODUCTION:
        if not raw_db_url:
            raise RuntimeError(
                "FATAL CONFIGURATION ERROR: DATABASE_URL environment variable is required in production. "
                "Render PostgreSQL connection string must be provided. SQLite fallback is strictly prohibited in production."
            )
        if raw_db_url.startswith("sqlite"):
            raise RuntimeError(
                "FATAL CONFIGURATION ERROR: Production environment cannot run on SQLite. "
                "A PostgreSQL DATABASE_URL must be configured."
            )
        db_url = raw_db_url
    else:
        # Local development must use SQLite if DATABASE_URL is not configured
        # Do NOT attempt to connect to Render PostgreSQL during normal local development
        if raw_db_url and not "render.com" in raw_db_url:
            db_url = raw_db_url
        else:
            db_url = f"sqlite:///{BASE_DIR / 'instance' / 'indobid.db'}"

    # Normalize Render postgresql connection string
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Engine parameters for Render PostgreSQL stability
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    } if not db_url.startswith("sqlite") else {}

    # Round duration in seconds (1 hour = 3600 seconds)
    ROUND_DURATION_SECONDS = int(os.getenv("ROUND_DURATION_SECONDS", "3600"))
    
    # Visual glass box display sample count (5 - 15 entries)
    GLASS_BOX_SAMPLE_SIZE = int(os.getenv("GLASS_BOX_SAMPLE_SIZE", "12"))
    
    # Default admin credentials for initial setup
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@indobid.lol")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "IndoBidAdmin2026!")

    # Listing price and currency configuration (defaults to $2 USD)
    LISTING_PRICE = float(os.getenv("LISTING_PRICE", "2.0"))
    CURRENCY = os.getenv("CURRENCY", "USD").upper()
    ENTRY_FEE_INR = float(os.getenv("ENTRY_FEE_INR", "49.0"))
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_placeholder")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "placeholder_secret")

class TestConfig(Config):
    """Configuration for automated testing."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    ROUND_DURATION_SECONDS = 3600
    SECRET_KEY = "test-secret-key"
    LISTING_PRICE = 2.0
    CURRENCY = "USD"
    ENTRY_FEE_INR = 49.0
    RAZORPAY_KEY_ID = "rzp_test_key123"
    RAZORPAY_KEY_SECRET = "test_secret_456"
