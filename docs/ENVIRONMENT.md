# INDOBID — ENVIRONMENT CONFIGURATION SPECIFICATION

---

## 1. Centralized Variable Map (`src/config/env.ts`)

| Variable Name | Required? | Scope | Purpose | Example / Masked |
| :--- | :---: | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | Server | PostgreSQL TLS Connection String | `postgresql://user:********@host:5432/indobid?sslmode=require` |
| `AUTH_SECRET` | **Yes** | Server | HMAC-SHA256 Session Signing Key | `********` |
| `ADMIN_EMAIL` | **Yes** | Server | Server-Authoritative Founder Email | `vishalkumar75912@gmail.com` |
| `ADMIN_SECRET_KEY` | **Yes** | Server | `/admin` Login Secret Key | `********` |
| `RAZORPAY_KEY_ID` | **Yes** | Public/Server | Razorpay Public Key ID | `rzp_live_********` |
| `RAZORPAY_KEY_SECRET`| **Yes** | Server | Razorpay Secret Key | `********` |
| `RAZORPAY_WEBHOOK_SECRET`| **Yes** | Server | Razorpay Webhook Signing Secret | `********` |
| `RESEND_API_KEY` | **Yes** | Server | Resend Email API Key | `re_********` |
| `EMAIL_FROM` | **Yes** | Server | Transactional Email Sender | `IndoBid <noreply@indobid.lol>` |
| `NEXT_PUBLIC_APP_URL`| **Yes** | Public/Server | Base Application URL | `https://indobid.lol` |

---

## 2. Security Containment
* Never prefix server-only secrets with `NEXT_PUBLIC_`.
* Production secrets live exclusively within the hosting provider's encrypted dashboard.
