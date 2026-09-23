import os
from sqlalchemy import create_engine, text
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
    """Initializes tables, ensures schema columns, and default admin user exists."""
    global engine

    if app and app.config.get("SQLALCHEMY_DATABASE_URI"):
        db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
        if db_uri != str(engine.url):
            engine_options = app.config.get("SQLALCHEMY_ENGINE_OPTIONS", {})
            if db_uri.startswith("sqlite"):
                engine_options = {"connect_args": {"check_same_thread": False}}
            engine = create_engine(db_uri, **engine_options)
            db_session.configure(bind=engine)

    # Ensure directory exists for local SQLite file
    if str(engine.url).startswith("sqlite"):
        db_path = str(engine.url).replace("sqlite:///", "")
        if db_path and db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    Base.metadata.create_all(bind=engine)

    # Safe migration helper for existing PostgreSQL tables on Render
    if "postgres" in str(engine.url):
        try:
            with engine.connect() as conn:
                for col_def in [
                    ("payments", "entry_id", "INTEGER REFERENCES entries(id) ON DELETE SET NULL"),
                    ("payments", "order_id", "VARCHAR(255)"),
                    ("payments", "transaction_id", "VARCHAR(255)"),
                    ("payments", "amount", "FLOAT DEFAULT 49.0"),
                    ("payments", "currency", "VARCHAR(16) DEFAULT 'INR'"),
                    ("payments", "status", "VARCHAR(32) DEFAULT 'created'"),
                    ("winners", "clicks", "INTEGER DEFAULT 0"),
                    ("winners", "views", "INTEGER DEFAULT 0"),
                ]:
                    table, col, col_type = col_def
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass
        except Exception:
            pass

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
