# INDOBID — PRODUCTION TROUBLESHOOTING PLAYBOOK

---

## 1. Quick Resolution Runbooks

### A. If: Login Fails
```text
→ Check 1: User existence (`SELECT id, email, email_verified_at, is_suspended FROM users WHERE email = ?`)
→ Check 2: Email verification (`email_verified_at` must not be null)
→ Check 3: Account suspension (`is_suspended === true` returns HTTP 403)
→ Check 4: Password verification using PBKDF2 (`src/lib/security/password.ts`)
→ Check 5: Rate limit lockout (`login_<ip>` sliding window in `src/lib/rate-limit/`)
```

---

### B. If: Post Isn't Created
```text
→ Check 1: Session state (Valid `indobid_session` cookie required)
→ Check 2: Category validity (`SELECT id FROM categories WHERE id = ?`)
→ Check 3: Content bounds (Title >= 3 chars, content >= 10 chars)
→ Check 4: Paid order state (Razorpay order created for $2+ USD)
→ Check 5: Rate limit (`create-debate:<ip>`)
```

---

### C. If: Payment Succeeds but Contribution Isn't Recorded
```text
→ Check 1: Frontend callback called `POST /api/payments/verify` with valid signature
→ Check 2: Razorpay HMAC signature matched `RAZORPAY_KEY_SECRET`
→ Check 3: Amount met step-up increment rule (>= lastContribution + 100 paise)
→ Check 4: Check server logs for transaction rollback in `prisma.$transaction()`
→ Check 5: Query `SELECT * FROM payments WHERE provider_payment_id = ?`
```

---

### D. If: Admin Login Fails
```text
→ Check 1: Entered email matches canonical `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`)
→ Check 2: Entered secret key matches exact `ADMIN_SECRET_KEY`
→ Check 3: Rate limit lockout (5 failed attempts locks IP for 15 minutes)
→ Check 4: Cookie security (`indobid_admin_session` over HTTPS in production)
```
