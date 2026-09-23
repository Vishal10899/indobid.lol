import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / ".env")

class Config:
    """Base application configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "indobid-secret-key-change-in-production-2026")
    
    # Database URL with Render postgresql fix
    db_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'indobid.db'}")
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

class TestConfig(Config):
    """Configuration for automated testing."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    ROUND_DURATION_SECONDS = 3600
    SECRET_KEY = "test-secret-key"
