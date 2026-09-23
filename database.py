import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from config import Config
from models import Base, AdminUser

engine = create_engine(
    Config.SQLALCHEMY_DATABASE_URI,
    **Config.SQLALCHEMY_ENGINE_OPTIONS
)

SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
db_session = scoped_session(SessionFactory)

def init_db(app=None):
    """Initializes tables and ensures default admin user exists."""
    # Ensure directory exists for SQLite
    if Config.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace("sqlite:///", "")
        if db_path and db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    Base.metadata.create_all(bind=engine)

    # Check for default admin user
    session = db_session()
    try:
        admin = session.query(AdminUser).filter_by(email=Config.ADMIN_EMAIL).first()
        if not admin and Config.ADMIN_EMAIL and Config.ADMIN_PASSWORD:
            admin = AdminUser(email=Config.ADMIN_EMAIL)
            admin.set_password(Config.ADMIN_PASSWORD)
            session.add(admin)
            session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()

def close_db(e=None):
    """Removes the thread-local database session."""
    db_session.remove()
