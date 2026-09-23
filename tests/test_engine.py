from datetime import timedelta
from models import Round, Entry, Winner, get_utc_now
from engine import get_current_round, sync_rounds, get_glass_box_entries, get_latest_completed_round

def test_get_current_round_initializes(db_sess):
    # Ensure current round initializes properly
    current_round = get_current_round(db_sess, duration_seconds=3600)
    assert current_round is not None
    assert current_round.status == "active"
    assert current_round.end_time > current_round.start_time

def test_entry_association_with_active_round(db_sess):
    current_round = get_current_round(db_sess, duration_seconds=3600)
    entry = Entry(
        round_id=current_round.id,
        display_name="Creator One",
        platform="twitter",
        profile_url="https://x.com/creatorone",
        status="eligible",
        created_at=get_utc_now()
    )
    db_sess.add(entry)
    db_sess.commit()

    saved_entry = db_sess.query(Entry).filter_by(display_name="Creator One").first()
    assert saved_entry is not None
    assert saved_entry.round_id == current_round.id

def test_sync_rounds_not_expired(db_sess):
    current_round = get_current_round(db_sess, duration_seconds=3600)
    # End time is in future
    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is False
    assert current_round.status == "active"

def test_sync_rounds_expired_selects_3_winners(db_sess):
    now = get_utc_now()
    # Create test round that expired 1 minute ago
    expired_round = Round(
        start_time=now - timedelta(hours=1, minutes=1),
        end_time=now - timedelta(minutes=1),
        status="active",
        created_at=now - timedelta(hours=1)
    )
    db_sess.add(expired_round)
    db_sess.commit()

    # Add 5 entries to this round
    for i in range(1, 6):
        db_sess.add(Entry(
            round_id=expired_round.id,
            display_name=f"User {i}",
            platform="twitter",
            profile_url=f"https://x.com/user{i}",
            status="eligible",
            created_at=now - timedelta(minutes=30)
        ))
    db_sess.commit()

    # Run engine sync
    completed = sync_rounds(db_sess, duration_seconds=3600)
    assert completed is True

    # Check expired round is marked completed
    db_sess.refresh(expired_round)
    assert expired_round.status == "completed"
    assert expired_round.completed_at is not None

    # Check 3 winners were created with positions 1, 2, 3
    winners = db_sess.query(Winner).filter_by(round_id=expired_round.id).order_by(Winner.position.asc()).all()
    assert len(winners) == 3
    assert [w.position for w in winners] == [1, 2, 3]
    assert [w.rank_label for w in winners] == ["Gold", "Silver", "Bronze"]

    # Verify a new active round was created
    new_active_round = db_sess.query(Round).filter_by(status="active").first()
    assert new_active_round is not None
    assert new_active_round.id != expired_round.id

def test_sync_rounds_idempotent(db_sess):
    # Calling sync_rounds again immediately should return False without duplicating winners
    completed_again = sync_rounds(db_sess, duration_seconds=3600)
    assert completed_again is False

def test_sync_rounds_zero_and_fewer_entries(db_sess):
    now = get_utc_now()
    # Round with 0 entries
    empty_round = Round(
        start_time=now - timedelta(hours=1),
        end_time=now - timedelta(minutes=1),
        status="active",
        created_at=now - timedelta(hours=1)
    )
    db_sess.add(empty_round)
    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600, force_close_id=empty_round.id)
    assert completed is True
    db_sess.refresh(empty_round)
    assert empty_round.status == "completed"
    winners = db_sess.query(Winner).filter_by(round_id=empty_round.id).all()
    assert len(winners) == 0

    # Round with 2 entries
    small_round = Round(
        start_time=now,
        end_time=now + timedelta(hours=1),
        status="active",
        created_at=now
    )
    db_sess.add(small_round)
    db_sess.commit()

    db_sess.add(Entry(round_id=small_round.id, display_name="Solo 1", platform="github", profile_url="https://github.com/1", status="eligible"))
    db_sess.add(Entry(round_id=small_round.id, display_name="Solo 2", platform="github", profile_url="https://github.com/2", status="eligible"))
    db_sess.commit()

    completed = sync_rounds(db_sess, duration_seconds=3600, force_close_id=small_round.id)
    assert completed is True
    small_winners = db_sess.query(Winner).filter_by(round_id=small_round.id).order_by(Winner.position.asc()).all()
    assert len(small_winners) == 2
    assert [w.position for w in small_winners] == [1, 2]

def test_glass_box_sample(db_sess):
    current_round = get_current_round(db_sess, duration_seconds=3600)
    for i in range(15):
        db_sess.add(Entry(
            round_id=current_round.id,
            display_name=f"Creator {i}",
            platform="youtube",
            profile_url=f"https://youtube.com/@creator{i}",
            status="eligible"
        ))
    db_sess.commit()

    sample = get_glass_box_entries(db_sess, current_round.id, sample_size=8)
    assert len(sample) == 8
    assert "display_name" in sample[0]
    assert "platform" in sample[0]
