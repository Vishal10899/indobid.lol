import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from config import Config, normalize_database_url
from models import Base, AdminUser, SiteSetting

engine = create_engine(
    Config.SQLALCHEMY_DATABASE_URI,
    **Config.SQLALCHEMY_ENGINE_OPTIONS
)

SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
db_session = scoped_session(SessionFactory)

def init_db(app=None):
    """Initializes tables, ensures schema columns, and default admin user/settings exist."""
    global engine

    if app and app.config.get("SQLALCHEMY_DATABASE_URI"):
        db_uri = normalize_database_url(app.config["SQLALCHEMY_DATABASE_URI"])
        try:
            current_url = engine.url.render_as_string(hide_password=False)
        except Exception:
            current_url = str(engine.url)
        if db_uri != current_url:
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
                # If entries exists but listings doesn't, rename entries to listings
                try:
                    conn.execute(text("ALTER TABLE IF EXISTS entries RENAME TO listings;"))
                    conn.commit()
                except Exception:
                    pass

                # Ensure columns on listings and related tables
                for col_def in [
                    ("listings", "username", "VARCHAR(128)"),
                    ("listings", "payment_status", "VARCHAR(32) DEFAULT 'SUCCESS'"),
                    ("listings", "payment_id", "VARCHAR(255)"),
                    ("listings", "click_count", "INTEGER DEFAULT 0"),
                    ("payments", "listing_id", "INTEGER REFERENCES listings(id) ON DELETE SET NULL"),
                    ("payments", "payment_id", "VARCHAR(255)"),
                    ("payments", "order_id", "VARCHAR(255)"),
                    ("payments", "amount", "FLOAT DEFAULT 2.0"),
                    ("payments", "currency", "VARCHAR(16) DEFAULT 'USD'"),
                    ("payments", "status", "VARCHAR(32) DEFAULT 'created'"),
                    ("winners", "listing_id", "INTEGER REFERENCES listings(id) ON DELETE CASCADE"),
                    ("site_visitors", "last_seen_at", "TIMESTAMP WITH TIME ZONE"),
                    ("site_visitors", "page_views", "INTEGER DEFAULT 1"),
                ]:
                    table, col, col_type = col_def
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};"))
                        conn.commit()
                    except Exception:
                        pass
        except Exception:
            pass

    # Ensure default admin user and default settings exist
    session = db_session()
    try:
        admin = session.query(AdminUser).filter_by(email=Config.ADMIN_EMAIL).first()
        if not admin and Config.ADMIN_EMAIL and Config.ADMIN_PASSWORD:
            admin = AdminUser(email=Config.ADMIN_EMAIL)
            admin.set_password(Config.ADMIN_PASSWORD)
            session.add(admin)
            session.commit()

        # Initialize default settings
        SiteSetting.get_settings(session)
    except Exception:
        session.rollback()
    finally:
        session.close()

def close_db(e=None):
    """Removes the thread-local database session."""
    db_session.remove()
