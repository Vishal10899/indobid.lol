from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Float, Index
)
from sqlalchemy.orm import declarative_base, relationship, synonym
from werkzeug.security import generate_password_hash, check_password_hash

Base = declarative_base()

def get_utc_now():
    """Returns current UTC datetime without microsecond noise for clean timestamps."""
    return datetime.now(timezone.utc).replace(microsecond=0)

def ensure_utc(dt):
    """Ensures datetime object is UTC-aware, normalizing naive datetimes from SQLite."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class Round(Base):
    """Represents an hourly draw round."""
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    start_time = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(32), nullable=False, default="active", index=True)  # 'active', 'completed', 'cancelled'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    listings = relationship("Listing", back_populates="round", cascade="all, delete-orphan", order_by="Listing.id.desc()")
    winners = relationship("Winner", back_populates="round", cascade="all, delete-orphan", order_by="Winner.position.asc()")

    # Backward compatibility alias
    @property
    def entries(self):
        return self.listings

    def to_dict(self):
        return {
            "id": self.id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "entries_count": len(self.listings) if self.listings is not None else 0,
            "winners": [w.to_dict() for w in self.winners] if self.winners is not None else []
        }

class Listing(Base):
    """Represents a submitted profile/link listing."""
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(128), nullable=False)
    display_name = synonym("username")
    platform = Column(String(64), nullable=False)  # 'twitter', 'instagram', 'youtube', 'tiktok', 'github', 'website', etc.
    profile_url = Column(Text, nullable=False)
    payment_status = Column(String(32), nullable=False, default="SUCCESS", index=True)  # 'SUCCESS', 'FAILED', 'PENDING'
    payment_id = Column(String(255), nullable=True, index=True)
    click_count = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="eligible", index=True)  # 'eligible', 'winner', 'rejected'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    # Relationships
    round = relationship("Round", back_populates="listings")
    winner_record = relationship("Winner", back_populates="listing", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="listing", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "round_id": self.round_id,
            "username": self.username,
            "display_name": self.username,
            "platform": self.platform,
            "profile_url": self.profile_url,
            "payment_status": self.payment_status,
            "payment_id": self.payment_id,
            "click_count": self.click_count,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

# Alias Entry to Listing for complete backward compatibility
Entry = Listing

class Winner(Base):
    """Represents one of the 3 selected winners (Gold, Silver, Bronze) of a round."""
    __tablename__ = "winners"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_id = synonym("listing_id")
    position = Column(Integer, nullable=False)  # 1 = Gold (🥇), 2 = Silver (🥈), 3 = Bronze (🥉)
    clicks = Column(Integer, nullable=False, default=0)
    views = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    # Relationships
    round = relationship("Round", back_populates="winners")
    listing = relationship("Listing", back_populates="winner_record")

    # Backward compatibility alias
    @property
    def entry(self):
        return self.listing

    @entry.setter
    def entry(self, value):
        self.listing = value

    @property
    def rank_label(self):
        labels = {1: "Gold", 2: "Silver", 3: "Bronze"}
        return labels.get(self.position, f"Top {self.position}")

    @property
    def medal_emoji(self):
        emojis = {1: "🥇", 2: "🥈", 3: "🥉"}
        return emojis.get(self.position, "🏅")

    def to_dict(self):
        return {
            "id": self.id,
            "round_id": self.round_id,
            "listing_id": self.listing_id,
            "entry_id": self.listing_id,
            "position": self.position,
            "rank_label": self.rank_label,
            "medal_emoji": self.medal_emoji,
            "clicks": self.clicks,
            "views": self.views,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "entry": self.listing.to_dict() if self.listing else None,
            "listing": self.listing.to_dict() if self.listing else None,
        }

class Payment(Base):
    """Payment records for paid entries via Razorpay."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True, index=True)
    entry_id = synonym("listing_id")
    provider = Column(String(64), nullable=False, default="razorpay")
    order_id = Column(String(255), nullable=True, index=True)
    payment_id = Column(String(255), nullable=True, index=True)
    transaction_id = synonym("payment_id")
    amount = Column(Float, nullable=False, default=2.0)
    currency = Column(String(16), nullable=False, default="USD")
    status = Column(String(32), nullable=False, default="created", index=True)  # 'created', 'paid', 'SUCCESS', 'failed'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    # Relationships
    listing = relationship("Listing", back_populates="payments")

    # Backward compatibility alias
    @property
    def entry(self):
        return self.listing

    @entry.setter
    def entry(self, value):
        self.listing = value

    def to_dict(self):
        return {
            "id": self.id,
            "listing_id": self.listing_id,
            "entry_id": self.listing_id,
            "provider": self.provider,
            "order_id": self.order_id,
            "payment_id": self.payment_id,
            "transaction_id": self.payment_id,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class SiteVisitor(Base):
    """Privacy-conscious visitor tracking without storing personal IP addresses permanently."""
    __tablename__ = "site_visitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    visitor_hash = Column(String(64), nullable=False, index=True)
    visited_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)
    page_views = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

class AdminUser(Base):
    """Administrator credentials for managing the platform."""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

class SiteSetting(Base):
    """Configurable platform settings managed via Admin Dashboard."""
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    listing_price = Column(Float, nullable=False, default=2.0)
    currency = Column(String(16), nullable=False, default="USD")
    site_name = Column(String(128), nullable=False, default="indobid.lol")
    site_logo = Column(String(255), nullable=True, default="")
    primary_color = Column(String(32), nullable=False, default="#7c3aed")
    secondary_color = Column(String(32), nullable=False, default="#f3e8ff")
    background_color = Column(String(32), nullable=False, default="#f8fafc")
    button_color = Column(String(32), nullable=False, default="#7c3aed")
    hero_heading = Column(String(255), nullable=False, default="Get Your Link On Top.")
    hero_description = Column(Text, nullable=False, default="List your product for $2 and take your chance. Every hour, 3 listings are randomly picked and featured at the top. Your product could be next.")
    homepage_text = Column(Text, nullable=False, default="Every paid listing has an equal chance of being selected.")
    razorpay_key_id = Column(String(255), nullable=True, default="")
    razorpay_key_secret = Column(String(255), nullable=True, default="")
    updated_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    @property
    def currency_symbol(self):
        symbols = {"USD": "$", "INR": "₹", "EUR": "€", "GBP": "£", "CAD": "C$", "AUD": "A$"}
        return symbols.get(self.currency.upper(), self.currency + " ")

    @classmethod
    def get_settings(cls, session):
        """Fetches current settings, initializing default row if not present."""
        from config import Config
        try:
            from flask import current_app
            app_cfg = current_app.config if current_app else {}
        except Exception:
            app_cfg = {}

        settings = session.query(cls).first()
        if not settings:
            price = app_cfg.get("LISTING_PRICE", getattr(Config, "LISTING_PRICE", 2.0))
            curr = app_cfg.get("CURRENCY", getattr(Config, "CURRENCY", "USD"))
            key_id = app_cfg.get("RAZORPAY_KEY_ID", getattr(Config, "RAZORPAY_KEY_ID", ""))
            key_sec = app_cfg.get("RAZORPAY_KEY_SECRET", getattr(Config, "RAZORPAY_KEY_SECRET", ""))

            settings = cls(
                listing_price=float(price),
                currency=str(curr),
                site_name="indobid.lol",
                site_logo="",
                primary_color="#7c3aed",
                secondary_color="#f3e8ff",
                background_color="#f8fafc",
                button_color="#7c3aed",
                hero_heading="Get Your Link On Top.",
                hero_description="List your product for $2 and take your chance. Every hour, 3 listings are randomly picked and featured at the top. Your product could be next.",
                homepage_text="Every paid listing has an equal chance of being selected.",
                razorpay_key_id="",
                razorpay_key_secret="",
                updated_at=get_utc_now()
            )
            session.add(settings)
            try:
                session.commit()
            except Exception:
                session.rollback()
                settings = session.query(cls).first()
        return settings

    def to_dict(self):
        return {
            "listing_price": self.listing_price,
            "currency": self.currency,
            "currency_symbol": self.currency_symbol,
            "site_name": self.site_name,
            "site_logo": self.site_logo,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            "background_color": self.background_color,
            "button_color": self.button_color,
            "hero_heading": self.hero_heading,
            "hero_description": self.hero_description,
            "homepage_text": self.homepage_text,
            "razorpay_key_id": self.razorpay_key_id,
        }
