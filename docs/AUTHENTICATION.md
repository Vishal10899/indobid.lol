# INDOBID — AUTHENTICATION & SECURITY SPECIFICATION

---

## 1. Password Hashing & Security Primitives
* **Algorithm**: PBKDF2-SHA512 (`crypto.pbkdf2Sync`)
* **Iterations**: 100,000 rounds
* **Salt**: 32-byte cryptographically random salt per user
* **Location**: [`src/lib/security/password.ts`](file:///D:/indobid.lol/src/lib/security/password.ts)

---

## 2. Session Token Lifecycle
* **Format**: HMAC-SHA256 Signed JSON Token (`payload.signature`)
* **Cookie Name**: `indobid_session`
* **Cookie Security**: `HttpOnly: true`, `SameSite: 'lax'`, `Secure: true` in production, `MaxAge: 30 days`
* **Suspension Revocation**: The server performs a live database verification on every request via `getCurrentUser()`. If `user.isSuspended === true`, the session is rejected immediately with HTTP 403 Forbidden.
* **Location**: [`src/lib/security/session.ts`](file:///D:/indobid.lol/src/lib/security/session.ts)

---

## 3. Email OTP & Password Reset
* **Email OTP**: 6-digit numeric code with 10-minute expiry and 60-second cooldown, delivered via Resend API ([`src/infrastructure/email/resend.email.ts`](file:///D:/indobid.lol/src/infrastructure/email/resend.email.ts)).
* **Password Reset**: 32-byte cryptographically secure token with 1-hour expiry, single-use consumption.

---

## 4. Founder & Admin Governance
* **Founder Email**: `vishalkumar75912@gmail.com` (server-authoritative lock in `src/config/env.ts`)
* **Secret Key Comparison**: `crypto.timingSafeEqual` over fixed-length buffers ([`src/lib/security/admin.ts`](file:///D:/indobid.lol/src/lib/security/admin.ts))
* **Brute-Force Lockout**: 5 failed attempts locks the IP for 15 minutes.
* **Founder Immunity**: Founder account cannot be suspended or deleted.
