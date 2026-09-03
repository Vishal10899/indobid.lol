# INDOBID — PRODUCTION TROUBLESHOOTING & INCIDENT RUNBOOK

**Document Version:** 2.0.0  
**Status:** Authoritative Production Troubleshooting Playbook  

---

## 1. Quick Resolution Runbooks

### Scenario A: User Login Fails
```text
→ Check 1: User existence (`SELECT id, email, email_verified_at, is_suspended FROM users WHERE email = ?`)
→ Check 2: Email verification (`email_verified_at` must not be null for regular users)
→ Check 3: Account suspension (`is_suspended === true` returns HTTP 403 Forbidden)
→ Check 4: Password verification using PBKDF2 (`src/modules/auth/password.service.ts`)
→ Check 5: Rate limit lockout (`login_<ip>` sliding window in `src/lib/rate-limit.ts`)
```

### Scenario B: Post Isn't Created
```text
→ Check 1: Session state (Valid `indobid_session` cookie or Bearer token required)
→ Check 2: Category validity (`SELECT id FROM categories WHERE id = ?`)
→ Check 3: Content bounds (Title >= 3 chars, content >= 5 chars, max 3000 chars)
→ Check 4: If Backed post ($2+ USD / 200 paise), verify Razorpay order creation
→ Check 5: Rate limit (`create-debate:<ip>`)
```

### Scenario C: Payment Succeeds but Debate / Contribution Remains Pending
```text
→ Check 1: Webhook received at `POST /api/webhooks/razorpay` (Verify HTTP 200 response in Razorpay dashboard)
→ Check 2: HMAC signature verified using `RAZORPAY_WEBHOOK_SECRET`
→ Check 3: Query payments table: `SELECT * FROM payments WHERE provider_payment_id = ?`
→ Check 4: Check server logs for ACID transaction failures in `PaymentService.processSuccessfulPayment()`
→ Check 5: Manual recovery: call `paymentService.processSuccessfulPayment({ providerPaymentId, amountPaise, ... })`
```

### Scenario D: Admin Login Fails
```text
→ Check 1: Entered email matches canonical `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`)
→ Check 2: Entered secret key matches exact `ADMIN_SECRET_KEY`
→ Check 3: Header check: supports `x-admin-secret` and `x-admin-key`
→ Check 4: Rate limit lockout (5 failed attempts locks IP for 15 minutes)
→ Check 5: Cookie security (`admin_session` requires HTTPS in production)
```

### Scenario E: Feed Displays No Discussions / Empty Feed
```text
→ Check 1: Query database for active debates: `SELECT count(*) FROM debates WHERE status = 'active'`
→ Check 2: If debates exist but aren't showing, verify category filtering parameters
→ Check 3: For Following feed, verify user follows authors with active debates
→ Check 4: Verify author diversity constraint isn't over-filtering single-author test datasets
```

### Scenario F: Email OTP Is Not Received
```text
→ Check 1: Verify `RESEND_API_KEY` is configured in production environment
→ Check 2: Check 60-second cooldown in `email_otps` table (`expires_at` and `created_at`)
→ Check 3: Check Resend API dashboard for bounced or rejected recipient emails
→ Check 4: Check spam / junk folders
```

### Scenario G: Creator Earnings Balance Mismatched
```text
→ Check 1: Query ledgers: `SELECT sum(creator_reward_paise) FROM creator_earnings_ledgers WHERE creator_username = ? AND status = 'available'`
→ Check 2: Verify self-support exclusion: debates where author supported themselves should have `creator_reward_paise = 0`
→ Check 3: Verify no pending contributions: continuations where payment failed generate ₹0 reward
→ Check 4: Reconstruct ledger if needed following `docs/BACKUP-RECOVERY.md`
```

### Scenario H: Database Connection Pool Exhausted
```text
→ Symptom: "Timed out fetching a connection from the pool" or 504 Gateway Timeout
→ Fix 1: Configure `connection_limit=10&pool_timeout=20` in `DATABASE_URL`
→ Fix 2: Verify global singleton `PrismaClient` reuse in `src/infrastructure/database/prisma.ts`
→ Fix 3: On high load, enable connection pooling via PgBouncer on Render
```
