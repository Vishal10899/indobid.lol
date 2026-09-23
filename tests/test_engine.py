from datetime import timedelta
from models import Round, Entry, Winner, Payment, get_utc_now
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

    # Add 5 paid entries to this round
    for i in range(1, 6):
        entry = Entry(
            round_id=expired_round.id,
            display_name=f"User {i}",
            platform="twitter",
            profile_url=f"https://x.com/user{i}",
            status="eligible",
            created_at=now - timedelta(minutes=30)
        )
        db_sess.add(entry)
        db_sess.flush()

        payment = Payment(
            entry_id=entry.id,
            provider="razorpay",
            order_id=f"order_test_{i}",
            transaction_id=f"pay_test_{i}",
            amount=49.0,
            currency="INR",
            status="paid",
            created_at=now - timedelta(minutes=30)
        )
        db_sess.add(payment)

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

def test_unpaid_and_failed_payment_entries_excluded(db_sess):
    now = get_utc_now()
    round_obj = Round(
        start_time=now - timedelta(hours=1, minutes=1),
        end_time=now - timedelta(minutes=1),
        status="active",
        created_at=now - timedelta(hours=1)
    )
    db_sess.add(round_obj)
    db_sess.commit()

    # 1 entry with pending/created payment (unpaid)
    e1 = Entry(round_id=round_obj.id, display_name="Unpaid User", platform="twitter", profile_url="https://x.com/unpaid", status="eligible")
    db_sess.add(e1)
    db_sess.flush()
    p1 = Payment(entry_id=e1.id, order_id="ord_pending", status="created", amount=49.0)
    db_sess.add(p1)

    # 1 entry with failed payment
    e2 = Entry(round_id=round_obj.id, display_name="Failed User", platform="github", profile_url="https://github.com/failed", status="eligible")
    db_sess.add(e2)
    db_sess.flush()
    p2 = Payment(entry_id=e2.id, order_id="ord_failed", status="failed", amount=49.0)
    db_sess.add(p2)

    # 1 entry without any payment record
    e3 = Entry(round_id=round_obj.id, display_name="No Pay User", platform="website", profile_url="https://nopay.com", status="eligible")
    db_sess.add(e3)

    db_sess.commit()

    # Draw round
    sync_rounds(db_sess, duration_seconds=3600, force_close_id=round_obj.id)

    # Should have 0 winners because none were paid
    winners = db_sess.query(Winner).filter_by(round_id=round_obj.id).all()
    assert len(winners) == 0

def test_sync_rounds_zero_one_two_three_or_more_entries(db_sess):
    now = get_utc_now()

    # Test 0 entries -> 0 winners
    r0 = Round(start_time=now, end_time=now + timedelta(hours=1), status="active", created_at=now)
    db_sess.add(r0)
    db_sess.commit()
    sync_rounds(db_sess, duration_seconds=3600, force_close_id=r0.id)
    assert len(db_sess.query(Winner).filter_by(round_id=r0.id).all()) == 0

    # Test 1 entry -> 1 winner (Gold)
    r1 = Round(start_time=now, end_time=now + timedelta(hours=1), status="active", created_at=now)
    db_sess.add(r1)
    db_sess.commit()
    e_solo = Entry(round_id=r1.id, display_name="Solo", platform="twitter", profile_url="https://x.com/solo", status="eligible")
    db_sess.add(e_solo)
    db_sess.flush()
    db_sess.add(Payment(entry_id=e_solo.id, order_id="ord_s", transaction_id="pay_s", status="paid", amount=49.0))
    db_sess.commit()
    sync_rounds(db_sess, duration_seconds=3600, force_close_id=r1.id)
    w1 = db_sess.query(Winner).filter_by(round_id=r1.id).all()
    assert len(w1) == 1
    assert w1[0].position == 1
    assert w1[0].rank_label == "Gold"

    # Test 2 entries -> 2 winners (Gold & Silver)
    r2 = Round(start_time=now, end_time=now + timedelta(hours=1), status="active", created_at=now)
    db_sess.add(r2)
    db_sess.commit()
    for i in range(1, 3):
        e = Entry(round_id=r2.id, display_name=f"Pair {i}", platform="github", profile_url=f"https://github.com/p{i}", status="eligible")
        db_sess.add(e)
        db_sess.flush()
        db_sess.add(Payment(entry_id=e.id, order_id=f"ord_p{i}", transaction_id=f"pay_p{i}", status="paid", amount=49.0))
    db_sess.commit()
    sync_rounds(db_sess, duration_seconds=3600, force_close_id=r2.id)
    w2 = db_sess.query(Winner).filter_by(round_id=r2.id).order_by(Winner.position.asc()).all()
    assert len(w2) == 2
    assert [w.position for w in w2] == [1, 2]
    assert [w.rank_label for w in w2] == ["Gold", "Silver"]

    # Test 4 entries -> 3 winners (Gold, Silver, Bronze)
    r4 = Round(start_time=now, end_time=now + timedelta(hours=1), status="active", created_at=now)
    db_sess.add(r4)
    db_sess.commit()
    for i in range(1, 5):
        e = Entry(round_id=r4.id, display_name=f"Quad {i}", platform="youtube", profile_url=f"https://youtube.com/q{i}", status="eligible")
        db_sess.add(e)
        db_sess.flush()
        db_sess.add(Payment(entry_id=e.id, order_id=f"ord_q{i}", transaction_id=f"pay_q{i}", status="paid", amount=49.0))
    db_sess.commit()
    sync_rounds(db_sess, duration_seconds=3600, force_close_id=r4.id)
    w4 = db_sess.query(Winner).filter_by(round_id=r4.id).order_by(Winner.position.asc()).all()
    assert len(w4) == 3
    assert [w.position for w in w4] == [1, 2, 3]

def test_sync_rounds_idempotent(db_sess):
    # Calling sync_rounds again immediately should return False without duplicating winners
    completed_again = sync_rounds(db_sess, duration_seconds=3600)
    assert completed_again is False

def test_glass_box_sample_only_paid(db_sess):
    current_round = get_current_round(db_sess, duration_seconds=3600)
    # Add paid entries
    for i in range(10):
        entry = Entry(
            round_id=current_round.id,
            display_name=f"Paid Creator {i}",
            platform="youtube",
            profile_url=f"https://youtube.com/@paid{i}",
            status="eligible"
        )
        db_sess.add(entry)
        db_sess.flush()
        db_sess.add(Payment(entry_id=entry.id, order_id=f"ord_gb_{i}", status="paid", amount=49.0))

    # Add unpaid entry
    unpaid_entry = Entry(
        round_id=current_round.id,
        display_name="Unpaid Lurker",
        platform="youtube",
        profile_url="https://youtube.com/@unpaid",
        status="eligible"
    )
    db_sess.add(unpaid_entry)
    db_sess.flush()
    db_sess.add(Payment(entry_id=unpaid_entry.id, order_id="ord_gb_unpaid", status="created", amount=49.0))
    db_sess.commit()

    sample = get_glass_box_entries(db_sess, current_round.id, sample_size=8)
    assert len(sample) == 8
    names = [s["display_name"] for s in sample]
    assert "Unpaid Lurker" not in names
    assert "initial" in sample[0]
