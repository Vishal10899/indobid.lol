# INDOBID — AUTHENTICATION & SECURITY ARCHITECTURE

**Document Version:** 2.0.0  
**Status:** Authoritative Authentication Reference  
**Modules:** `src/modules/auth/`, `src/infrastructure/database/repositories/`  

---

## 1. System Overview & Principles

Authentication and identity management in IndoBid are centralized in `src/modules/auth/`. The system enforces the following inviolable principles:
1. **Zero Client Trust:** Identity claims (`role`, `isFounder`, `isAdmin`, `userId`, `authorId`) submitted in request payloads are unconditionally ignored. All privileges are derived strictly from verified cryptographic session tokens and authoritative database records.
2. **Deterministic Credential Security:** Passwords are never stored in plaintext. They are salted and hashed using PBKDF2 with SHA-256 and constant-time verification.
3. **Multi-Step Account Verification:** New signups require 6-digit email OTP verification before gaining full platform write access.
4. **Permanent Founder Authority:** The Founder role is strictly locked to normalized `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`). Founder accounts cannot be suspended, deleted, or altered by client requests.

---

## 2. Directory Structure (`src/modules/auth/`)

```
src/modules/auth/
├── auth.service.ts             # Signup, login, credential validation, user provisioning
├── auth.repository.ts          # Auth repository facade delegating to database layer
├── auth.types.ts               # Strong TypeScript interfaces for tokens, payloads, credentials
├── auth.validation.ts          # Zod validation schemas for auth endpoints
├── password.service.ts         # PBKDF2 password hashing & timingSafeEqual comparison
├── session.service.ts          # HMAC-SHA256 session token issuance & cookie verification
├── otp.service.ts              # 6-digit email OTP generation, hashing, cooldown & 5-attempt lock
├── password-reset.service.ts   # 64-char single-use password reset tokens with 60m expiry
├── authorization.ts            # Centralized RBAC, isFounder, isAuthorizedAdmin guards
└── index.ts                    # Public gateway barrel export
```

---

## 3. Password Hashing & Verification (`password.service.ts`)

* **Algorithm:** PBKDF2 (Password-Based Key Derivation Function 2)
* **Digest:** SHA-256
* **Iterations:** 1,000 iterations
* **Salt:** 16-byte random hex string generated via `crypto.randomBytes(16)`
* **Format Stored:** `salt:key` (hex encoded)
* **Verification:** Recomputes derived key using stored salt and compares using `crypto.timingSafeEqual()` to prevent timing attacks.

---

## 4. Session Token Lifecycle (`session.service.ts`)

* **Signature Scheme:** HMAC-SHA256 over base64-encoded session payload (`userId`, `email`, `role`, `issuedAt`, `expiresAt`).
* **Transport Mechanisms:**
  1. `indobid_session` Cookie: `HttpOnly: true`, `SameSite: 'lax'`, `Secure: true` in production, `MaxAge: 30 days`.
  2. `Authorization: Bearer <token>` Header: For mobile clients, API integrations, and programmatic access.
* **Revocation & Suspension:** `sessionService.getCurrentUser()` performs live database verification. If `user.isSuspended === true`, the session is rejected with HTTP 403 Forbidden.

---

## 5. Email OTP Verification Engine (`otp.service.ts`)

* **Code Generation:** Cryptographically random 6-digit numeric string (`crypto.randomInt(100000, 1000000)`).
* **Storage Security:** Stored as PBKDF2 hash with unique salt in `email_otps` table. Plaintext OTP is never persisted.
* **Expiry:** 10 minutes from issuance (`expiresAt`).
* **Abuse Mitigation (60-Second Cooldown):** Rapid re-requests within 60 seconds return HTTP 429 with remaining cooldown seconds.
* **Lockout Policy (5 Failed Attempts):** Each incorrect verification increments `attempts`. Reaching 5 failed attempts permanently locks the code.

---

## 6. Password Reset Protocol (`password-reset.service.ts`)

* **Token Generation:** 64-character cryptographically secure hex token (`crypto.randomBytes(32).toString('hex')`).
* **Storage Security:** Token is hashed with salt via PBKDF2 before storing in `password_reset_tokens`.
* **Single-Use Consumption:** Consuming the token marks `used: true`, preventing replay attacks.
* **Enumeration Defense:** Requesting a reset for a non-existent email returns the identical generic success response (`{ success: true, message: "If that email is registered, a reset link has been sent." }`).

---

## 7. Founder & Admin Authorization Primitives (`authorization.ts`)

* **`isFounder(user)`:**
  * Checks if `normalizeEmail(user.email) === ADMIN_EMAIL` and `user.role === 'founder' || user.role === 'admin'`.
  * Protects administrative functions and prevents suspension/deletion.
* **`isAuthorizedAdmin(request)`:**
  * Accepts `ADMIN_SECRET_KEY` via `x-admin-secret` or `x-admin-key` custom headers.
  * Accepts `Authorization: Bearer <ADMIN_SECRET_KEY>`.
  * Accepts verified Founder session cookie.
  * Comparison uses `crypto.timingSafeEqual()`.
