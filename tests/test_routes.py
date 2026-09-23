import json
import uuid
from config import Config

def test_homepage_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "YOUR LUCK" in html
    assert "COULD PUT YOU ON TOP" in html
    assert "CURRENT ENTRIES" in html
    assert "NEXT DRAW IN" in html

def test_entry_submit_json_success(client):
    unique_url = f"https://x.com/unique_{uuid.uuid4().hex[:8]}"
    payload = {
        "display_name": "Test Builder",
        "platform": "twitter",
        "profile_url": unique_url
    }
    response = client.post(
        "/entry/submit",
        data=json.dumps(payload),
        content_type="application/json"
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert "You are entered into Round #" in data["message"]

def test_entry_submit_duplicate_in_same_round(client):
    unique_dup_url = f"https://x.com/dup_{uuid.uuid4().hex[:8]}"
    payload = {
        "display_name": "Test Builder",
        "platform": "twitter",
        "profile_url": unique_dup_url
    }
    # First submit
    res1 = client.post("/entry/submit", data=json.dumps(payload), content_type="application/json")
    assert res1.status_code == 201

    # Second submit with same profile_url
    res2 = client.post("/entry/submit", data=json.dumps(payload), content_type="application/json")
    assert res2.status_code == 200
    data = res2.get_json()
    assert data.get("already_entered") is True

def test_entry_submit_invalid(client):
    # Missing display name
    payload = {
        "display_name": "",
        "platform": "twitter",
        "profile_url": "https://x.com/test"
    }
    response = client.post(
        "/entry/submit",
        data=json.dumps(payload),
        content_type="application/json"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert len(data["errors"]) > 0

    # Invalid URL
    payload2 = {
        "display_name": "Valid Name",
        "platform": "twitter",
        "profile_url": "not-a-valid-url"
    }
    response2 = client.post(
        "/entry/submit",
        data=json.dumps(payload2),
        content_type="application/json"
    )
    assert response2.status_code == 400

def test_round_status_api(client):
    response = client.get("/api/round-status")
    assert response.status_code == 200
    data = response.get_json()
    assert "round_id" in data
    assert "end_time" in data
    assert "remaining_seconds" in data
    assert "entries_count" in data
    assert "glass_box_entries" in data

def test_winners_page(client):
    response = client.get("/winners")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Winners Archive" in html

def test_about_page(client):
    response = client.get("/about")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "About indobid.lol" in html
    assert "No Accounts. No Passwords." in html

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"

def test_admin_protection(client):
    # Unauthenticated user redirected to admin login
    response = client.get("/admin/dashboard", follow_redirects=False)
    assert response.status_code == 302
    assert "/admin/login" in response.headers["Location"]

def test_admin_login_and_dashboard(client):
    # Attempt login with configured credentials
    login_res = client.post(
        "/admin/login",
        data={"email": Config.ADMIN_EMAIL, "password": Config.ADMIN_PASSWORD},
        follow_redirects=True
    )
    assert login_res.status_code == 200
    html = login_res.get_data(as_text=True)
    assert "Administrator Dashboard" in html
    assert "Round Operations" in html

    # Trigger Seed
    seed_res = client.post("/admin/seed-entries", follow_redirects=True)
    assert seed_res.status_code == 200
    assert "Successfully added" in seed_res.get_data(as_text=True)

    # Trigger Draw
    draw_res = client.post("/admin/trigger-draw", follow_redirects=True)
    assert draw_res.status_code == 200
    assert "completed!" in draw_res.get_data(as_text=True)

def test_security_headers(client):
    response = client.get("/")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"

def test_404_handling(client):
    # Web 404
    res_web = client.get("/non-existent-page")
    assert res_web.status_code == 404
    assert "404" in res_web.get_data(as_text=True)

    # API 404
    res_api = client.get("/api/non-existent-endpoint")
    assert res_api.status_code == 404
    assert res_api.get_json()["success"] is False

def test_admin_invalid_login(client):
    res = client.post(
        "/admin/login",
        data={"email": "wrong@admin.com", "password": "WrongPassword123!"},
        follow_redirects=True
    )
    assert res.status_code == 200
    assert "Invalid administrator credentials" in res.get_data(as_text=True)
