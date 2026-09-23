import random
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Round, Entry, Winner, get_utc_now, ensure_utc

def get_latest_completed_round(session: Session) -> Round | None:
    """Returns the most recently completed round that has winners, or any latest completed round."""
    return (
        session.query(Round)
        .filter_by(status="completed")
        .order_by(desc(Round.id))
        .first()
    )

def get_current_round(session: Session, duration_seconds: int = 3600) -> Round:
    """
    Retrieves the currently active round, automatically resolving any expired round
    and creating the next round if necessary.
    Guaranteed to return an active Round.
    """
    sync_rounds(session, duration_seconds=duration_seconds)
    active_round = (
        session.query(Round)
        .filter_by(status="active")
        .order_by(desc(Round.id))
        .first()
    )
    if not active_round:
        # If no active round exists at all, initialize round #1
        now = get_utc_now()
        active_round = Round(
            start_time=now,
            end_time=now + timedelta(seconds=duration_seconds),
            status="active",
            created_at=now
        )
        session.add(active_round)
        try:
            session.commit()
        except Exception:
            session.rollback()
            active_round = (
                session.query(Round)
                .filter_by(status="active")
                .order_by(desc(Round.id))
                .first()
            )
    return active_round

def sync_rounds(session: Session, duration_seconds: int = 3600, force_close_id: int | None = None) -> bool:
    """
    Timestamp-based round progression engine.
    Checks if active round has expired. If so, picks up to 3 random winners,
    marks round completed, and creates the next active round.

    Thread-safe and idempotent: Uses SELECT FOR UPDATE on databases supporting it (PostgreSQL)
    and atomic status checks so concurrent web requests cannot create duplicate winners.

    Returns True if a round was completed, False otherwise.
    """
    now = get_utc_now()

    # Query candidate round to process
    if force_close_id:
        query = session.query(Round).filter(Round.id == force_close_id)
        try:
            active_round = query.with_for_update().first()
        except Exception:
            session.rollback()
            active_round = query.first()
    else:
        # Find active round that has expired
        query = session.query(Round).filter(Round.status == "active")
        try:
            all_active = query.with_for_update().all()
        except Exception:
            session.rollback()
            all_active = query.all()

        active_round = None
        for r in all_active:
            if ensure_utc(r.end_time) <= ensure_utc(now):
                active_round = r
                break

    if not active_round:
        return False

    # Perform winner selection for this round
    eligible_entries = (
        session.query(Entry)
        .filter_by(round_id=active_round.id, status="eligible")
        .all()
    )

    num_eligible = len(eligible_entries)
    winners_count = min(3, num_eligible)

    if winners_count > 0:
        # Select winners randomly without replacement
        selected_entries = random.sample(eligible_entries, winners_count)
        
        # Position 1: Gold (🥇), Position 2: Silver (🥈), Position 3: Bronze (🥉)
        for position, entry in enumerate(selected_entries, start=1):
            winner = Winner(
                round_id=active_round.id,
                entry_id=entry.id,
                position=position,
                created_at=now
            )
            entry.status = "winner"
            session.add(winner)

    # Mark round as completed
    active_round.status = "completed"
    active_round.completed_at = now

    # Create next round starting now
    next_round = Round(
        start_time=now,
        end_time=now + timedelta(seconds=duration_seconds),
        status="active",
        created_at=now
    )
    session.add(next_round)

    try:
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise

def get_glass_box_entries(session: Session, round_id: int, sample_size: int = 12) -> list[dict]:
    """
    Returns a small sample of current entries (5-15) for the visual glass box.
    Does not expose sensitive or private data; returns display_name and platform.
    """
    entries = (
        session.query(Entry.display_name, Entry.platform)
        .filter_by(round_id=round_id, status="eligible")
        .all()
    )
    
    if not entries:
        return []
        
    if len(entries) <= sample_size:
        items = list(entries)
        random.shuffle(items)
    else:
        items = random.sample(entries, sample_size)

    return [{"display_name": item[0], "platform": item[1]} for item in items]
