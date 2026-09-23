# indobid.lol

> **YOUR LUCK COULD PUT YOU ON TOP.**  
> Submit your profile. Three profiles are featured every hour.  
> An ultra-lightweight, sleep-proof hourly profile-discovery platform engineered specifically for **Render Free**.

---

## 🌟 Product Philosophy

* **Zero Accounts for Visitors:** Normal users never register, log in, or remember passwords. Anyone can submit a display name and profile URL in seconds.
* **Paid Creator Entries:** Each entry is secured through Razorpay (configurable, default ₹49/entry). Only verified paid entries participate in the hourly draw.
* **Sleep-Proof Timestamp Engine:** Free tier instances sleep when idle. The database is the single source of truth for rounds. Round resolution executes deterministically and idempotently on incoming requests.
* **Privacy-Conscious Real Metrics:** All displayed stats (Total Visitors, Total Entries, Profile Clicks) are authentic database records. Zero fake or hardcoded numbers in production.
* **Minimalist & Fast:** No heavy frameworks, no microservices, no Redis, no WebSockets. Built with Python, Flask, SQLAlchemy, Tailwind CSS, and Vanilla JavaScript.
* **Permanent Hall of Fame:** Every hourly champion (🥇 Gold, 🥈 Silver, 🥉 Bronze) is permanently recorded in PostgreSQL and archived on `/winners`.

---

## 🏗️ Architecture

```text
Browser (Vanilla JS + Tailwind CSS)
   ↓ HTTP / JSON / Razorpay Checkout
Flask (Python 3.11+ / Gunicorn)
   ↓ SQLAlchemy
PostgreSQL (Render PostgreSQL / SQLite local fallback)
```

### Database Schema

1. **`rounds`**: `id`, `start_time`, `end_time`, `status`, `created_at`, `completed_at`
2. **`entries`**: `id`, `round_id`, `display_name`, `platform`, `profile_url`, `status`, `created_at`
3. **`winners`**: `id`, `round_id`, `entry_id`, `position` (1 = Gold, 2 = Silver, 3 = Bronze), `clicks`, `views`, `created_at`
4. **`payments`**: `id`, `entry_id`, `provider`, `order_id`, `transaction_id`, `amount`, `currency`, `status`, `created_at`
5. **`site_visitors`**: `id`, `visitor_hash`, `visited_date`, `created_at`
6. **`admin_users`**: `id`, `email`, `password_hash`, `created_at`

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.11+ (tested on Python 3.11 - 3.14)
- Git

### 2. Setup Virtual Environment
```bash
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If `DATABASE_URL` is omitted, the app will automatically use a local SQLite database at `instance/indobid.db`)*

### 4. Run the Application
```bash
python app.py
```
Open your browser to [http://localhost:5000](http://localhost:5000).

---

## 🧪 Automated Testing

Run the full pytest suite:
```bash
pytest -v
```
All 26 integration and unit tests cover:
- Idempotent timestamp engine progression & round expiry
- Winner selection (0 entries, 1 entry, 2 entries, 3+ entries)
- Unpaid and failed payment exclusion from draws
- Razorpay order creation (`/entry/create-order`)
- Server-side Razorpay HMAC-SHA256 signature verification (`/entry/verify-payment`)
- Tampered signature rejection & failed payment handling
- Duplicate profile URL prevention per active round
- Profile click tracking & 302 redirection (`/profile/<id>/visit`)
- Privacy-conscious daily unique visitor tracking & live stats
- Admin authentication, rate limiting, and dashboard operations
- Production `DATABASE_URL` strict enforcement & dev-only seeding
- Legal pages (`/rules`, `/terms`, `/privacy`, `/refunds`, `/about`, `/winners`)

---

## ☁️ Deployment on Render (Render Free)

The project includes a ready-to-deploy [`render.yaml`](render.yaml) blueprint:

1. Connect your repository to **Render**.
2. Create a **Blueprint** or **Web Service**:
   - **Environment:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4`
   - **Health Check Path:** `/health`
3. Configure environment variables in the Render dashboard:
   - `DATABASE_URL` (automatically linked from Render PostgreSQL)
   - `SECRET_KEY` (generated)
   - `ENTRY_FEE_INR` (e.g. `49.0`)
   - `RAZORPAY_KEY_ID` (your Razorpay Key ID)
   - `RAZORPAY_KEY_SECRET` (your Razorpay Key Secret)
   - `ADMIN_EMAIL` & `ADMIN_PASSWORD`
