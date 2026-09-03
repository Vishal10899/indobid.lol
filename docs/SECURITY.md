# INDOBID — SECURITY CONTROLS, THREAT MITIGATION & DEFENSE SPECIFICATION

**Document Version:** 2.0.0  
**Status:** Authoritative Security Reference  

---

## 1. Security Architecture & Threat Mitigation Matrix

| Security Domain | Defense Mechanism | Implementation Location |
| :--- | :--- | :--- |
| **Password Storage** | PBKDF2 with SHA-256, 1,000 iterations, 16-byte random salt, constant-time verification | [`src/modules/auth/password.service.ts`](file:///D:/indobid.lol/src/modules/auth/password.service.ts) |
| **Session Integrity** | HMAC-SHA256 signature, 30-day expiry, live DB suspension revocation check | [`src/modules/auth/session.service.ts`](file:///D:/indobid.lol/src/modules/auth/session.service.ts) |
| **Cookie Security** | `HttpOnly: true`, `SameSite: 'lax'`, `Secure: true` (production), path `/` | [`src/config/security.ts`](file:///D:/indobid.lol/src/config/security.ts) |
| **Founder Authority** | Immutable server lock to canonical `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`) | [`src/modules/auth/authorization.ts`](file:///D:/indobid.lol/src/modules/auth/authorization.ts) |
| **Admin Route Protection** | Constant-time `crypto.timingSafeEqual` comparison on `ADMIN_SECRET_KEY` | [`src/modules/auth/authorization.ts`](file:///D:/indobid.lol/src/modules/auth/authorization.ts) |
| **OTP Abuse Defense** | 60-second re-request cooldown, hard lockout after 5 failed verification attempts | [`src/modules/auth/otp.service.ts`](file:///D:/indobid.lol/src/modules/auth/otp.service.ts) |
| **Password Reset Safety** | 64-character random hex token, PBKDF2 hashed, 60m expiry, single-use invalidation | [`src/modules/auth/password-reset.service.ts`](file:///D:/indobid.lol/src/modules/auth/password-reset.service.ts) |
| **Payment Verification** | Cryptographic HMAC-SHA256 verification of `orderId|paymentId` | [`src/infrastructure/payments/razorpay.adapter.ts`](file:///D:/indobid.lol/src/infrastructure/payments/razorpay.adapter.ts) |
| **Webhook Verification** | HMAC-SHA256 signature verification against `RAZORPAY_WEBHOOK_SECRET` | [`src/app/api/webhooks/razorpay/route.ts`](file:///D:/indobid.lol/src/app/api/webhooks/razorpay/route.ts) |
| **Double-Spend Exclusion** | Database `UNIQUE` constraints on `providerPaymentId` and `contributionId` | [`prisma/schema.prisma`](file:///D:/indobid.lol/prisma/schema.prisma) |
| **IDOR Protection** | Server-authoritative ownership policy checking (`debatePolicy.canEdit`) | [`src/modules/debates/debate.policy.ts`](file:///D:/indobid.lol/src/modules/debates/debate.policy.ts) |
| **Input Validation** | Strict Zod schemas validating lengths, formats, and types before domain execution | Controller routes (`src/app/api/`) |
| **Injection Defense** | Parameterized Prisma queries eliminating SQL injection | [`src/infrastructure/database/repositories/`](file:///D:/indobid.lol/src/infrastructure/database/repositories/) |
| **Media File Safety** | Binary magic-byte inspection (PNG, JPEG, GIF, WEBP), 2MB payload ceiling | [`src/infrastructure/storage/magic-bytes.ts`](file:///D:/indobid.lol/src/infrastructure/storage/magic-bytes.ts) |
| **Rate Limiting** | Sliding-window token bucket tracking IP and caller tokens | [`src/lib/rate-limit.ts`](file:///D:/indobid.lol/src/lib/rate-limit.ts) |
| **Secret Management** | Server-only Zod validation, never leaking secrets to public client payloads | [`src/config/env.ts`](file:///D:/indobid.lol/src/config/env.ts) |
| **Sensitive Data Masking**| Payout bank/UPI details stored masked (`•••• 4821`), logs redact sensitive tokens | [`src/modules/creator-earnings/payout.service.ts`](file:///D:/indobid.lol/src/modules/creator-earnings/payout.service.ts) |

---

## 2. Insecure Client Parameter Rejection

IndoBid adheres to the rule that **the server is the sole source of truth**.

API endpoints reject or strip all client-supplied authority overrides:
* `role: "admin"` or `role: "founder"` in registration or update payloads is ignored; regular accounts are assigned `role = "user"`.
* `isFounder: true` or `isAdmin: true` in user payloads is strictly ignored.
* `rankingScore` submitted from client browsers is discarded; scores are calculated server-side.
* `creatorRewardPaise` submitted from clients is discarded; 50/50 splits are computed server-side.
* `userId` or `authorId` in requests is superseded by the authenticated session user.
