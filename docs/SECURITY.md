# INDOBID — SECURITY CONTROLS & THREAT MITIGATION SPECIFICATION

---

## 1. Security Architecture Map

| Control Area | Security Mechanism | Code Location |
| :--- | :--- | :--- |
| **Password Storage** | PBKDF2-SHA512 (100k rounds + 32-byte salt) | `src/lib/security/password.ts` |
| **Admin Authentication** | Timing-safe buffer comparison (`crypto.timingSafeEqual`) | `src/lib/security/admin.ts` |
| **Founder Identity** | Server-authoritative lock to `ADMIN_EMAIL` | `src/config/env.ts` |
| **Session Cookies** | HMAC-SHA256 Signed Token (`HttpOnly`, `SameSite: Lax`, `Secure`) | `src/lib/security/session.ts` |
| **Live Revocation** | Database query check for `isSuspended` on every request | `src/lib/user-auth.ts` |
| **Brute Force Lockout** | 5 failed admin attempts $\to$ 15-minute IP lockout | `src/lib/security/admin.ts` |
| **Payment Verification** | Cryptographic HMAC-SHA256 signature checking | `src/infrastructure/payments/razorpay/verification.ts` |
| **Webhook Verification** | Cryptographic HMAC-SHA256 signature checking | `src/infrastructure/payments/razorpay/webhooks.ts` |
| **IDOR Protection** | Server-side user ownership verification on all resource edits | API route handlers |
| **Media Safety** | Binary magic byte verification (JPEG, PNG, GIF, WebP) | `src/infrastructure/storage/magic-bytes.ts` |
| **Log Sanitization** | Automatic masking of secrets, passwords, OTPs, and tokens | `src/infrastructure/logging/logger.ts` |
