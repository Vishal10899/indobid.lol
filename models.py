from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Float, Index
)
from sqlalchemy.orm import declarative_base, relationship
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
    status = Column(String(32), nullable=False, default="active", index=True) # 'active', 'completed', 'cancelled'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    entries = relationship("Entry", back_populates="round", cascade="all, delete-orphan", order_by="Entry.id.desc()")
    winners = relationship("Winner", back_populates="round", cascade="all, delete-orphan", order_by="Winner.position.asc()")

    def to_dict(self):
        return {
            "id": self.id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "entries_count": len(self.entries) if self.entries is not None else 0,
            "winners": [w.to_dict() for w in self.winners] if self.winners is not None else []
        }

class Entry(Base):
    """Represents a profile entry submitted by a visitor."""
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name = Column(String(128), nullable=False)
    platform = Column(String(64), nullable=False)  # e.g., 'twitter', 'instagram', 'youtube', 'github', 'website'
    profile_url = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="eligible", index=True)  # 'eligible', 'winner', 'rejected'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    # Relationships
    round = relationship("Round", back_populates="entries")
    winner_record = relationship("Winner", back_populates="entry", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="entry", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "round_id": self.round_id,
            "display_name": self.display_name,
            "platform": self.platform,
            "profile_url": self.profile_url,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Winner(Base):
    """Represents one of the 3 selected winners (Gold, Silver, Bronze) of a round."""
    __tablename__ = "winners"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)  # 1 = Gold (🥇), 2 = Silver (🥈), 3 = Bronze (🥉)
    clicks = Column(Integer, nullable=False, default=0)
    views = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    # Relationships
    round = relationship("Round", back_populates="winners")
    entry = relationship("Entry", back_populates="winner_record")

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
            "entry_id": self.entry_id,
            "position": self.position,
            "rank_label": self.rank_label,
            "medal_emoji": self.medal_emoji,
            "clicks": self.clicks,
            "views": self.views,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "entry": self.entry.to_dict() if self.entry else None,
        }

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

class Payment(Base):
    """Payment records for paid entries via Razorpay."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True)
    provider = Column(String(64), nullable=False, default="razorpay")
    order_id = Column(String(255), nullable=True, index=True)
    transaction_id = Column(String(255), nullable=True, index=True)
    amount = Column(Float, nullable=False, default=49.0)
    currency = Column(String(16), nullable=False, default="INR")
    status = Column(String(32), nullable=False, default="created", index=True)  # 'created', 'pending', 'paid', 'failed', 'refunded'
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)

    entry = relationship("Entry", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "entry_id": self.entry_id,
            "provider": self.provider,
            "order_id": self.order_id,
            "transaction_id": self.transaction_id,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class SiteVisitor(Base):
    """Privacy-conscious daily visitor tracking without storing personal IP addresses permanently."""
    __tablename__ = "site_visitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    visitor_hash = Column(String(64), nullable=False, index=True)
    visited_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    created_at = Column(DateTime(timezone=True), nullable=False, default=get_utc_now)
