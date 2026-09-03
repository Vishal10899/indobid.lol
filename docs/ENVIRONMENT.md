# INDOBID — ENVIRONMENT CONFIGURATION & SECRETS ARCHITECTURE

**Document Version:** 2.0.0  
**Status:** Authoritative Environment Reference  
**Implementation:** `src/config/env.ts`  

---

## 1. Centralized Zod Validation Layer

IndoBid enforces centralized environment variable validation at application initialization. Server code does not read `process.env.*` directly throughout domain modules; instead, code imports the validated `env` singleton from `src/config/env.ts`.

If any mandatory production secret is absent or malformed, the application immediately throws a `ZodError` during bootstrap and halts execution, preventing partial initialization or silent security degradations.

---

## 2. Environment Variables Specification

| Variable Name | Required | Scope | Validation Rule | Purpose |
| :--- | :---: | :--- | :--- | :--- |
| `DATABASE_URL` | YES | Server-only | Valid PostgreSQL URI | Primary PostgreSQL connection with SSL |
| `SESSION_SECRET` / `AUTH_SECRET` | YES | Server-only | Min 32 chars | HMAC-SHA256 session token signing key |
| `ADMIN_EMAIL` | YES | Server-only | Valid email | Canonical Founder email (`vishalkumar75912@gmail.com`) |
| `ADMIN_SECRET_KEY` | YES | Server-only | Min 16 chars | Cryptographic secret for `/admin` endpoints |
| `RAZORPAY_KEY_ID` | YES | Public/Server | Non-empty string | Razorpay API public key identifier |
| `RAZORPAY_KEY_SECRET` | YES | Server-only | Non-empty string | Razorpay API private secret |
| `RAZORPAY_WEBHOOK_SECRET` | YES | Server-only | Non-empty string | Secret for verifying webhook HMAC signatures |
| `RESEND_API_KEY` | YES | Server-only | Non-empty string | Transactional email dispatch key |
| `EMAIL_FROM` | NO | Server-only | String / Default | Sender address (Default: `IndoBid <noreply@indobid.lol>`) |
| `NEXT_PUBLIC_APP_URL` | YES | Public/Client | Valid HTTP(S) URL | Canonical application domain (`https://indobid.lol`) |
| `NODE_ENV` | NO | System | `development`, `production`, `test` | Runtime mode selector |

---

## 3. Secret Isolation & Bundling Rules

1. **Client Isolation:** Never prefix server secrets (`ADMIN_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `SESSION_SECRET`, `RESEND_API_KEY`) with `NEXT_PUBLIC_`. Turbopack will strictly bundle only variables explicitly marked `NEXT_PUBLIC_` into client chunks.
2. **Timing-Safe Evaluation:** Secrets such as `ADMIN_SECRET_KEY` and session signatures are evaluated using `crypto.timingSafeEqual()` across equal-length buffers to eliminate side-channel timing attacks.
3. **Redaction in Logging:** The centralized logger (`src/infrastructure/logging/logger.ts`) sanitizes log outputs, redacting values matching authorization headers, tokens, passwords, and secrets.
