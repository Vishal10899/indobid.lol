# INDOBID — AUTOMATED TESTING HARNESS & VERIFICATION SPECIFICATION

**Document Version:** 2.0.0  
**Status:** Authoritative Testing Reference  
**Test Suite Path:** `tests/run-all-tests.ts`  
**Current Baseline:** 193/193 Tests Passing (100% Coverage across All 13 Parts)  

---

## 1. Test Harness Overview

IndoBid is guarded by a comprehensive, end-to-end automated verification harness containing **193 rigorous integration and unit tests**. The suite runs in under 3 minutes against the staging/development PostgreSQL database.

### Execution Command:
```bash
npx tsx tests/run-all-tests.ts
```

---

## 2. Test Suite Breakdown by Part

| Part | Subsystem Tested | Tests | Key Invariants Verified |
| :---: | :--- | :---: | :--- |
| **Part 1** | Debates & Sequential Continuations | 1–25 | $2 floor, sequence #1 creation, $1 minimum escalation, payment activation |
| **Part 2** | Razorpay Gateway & Webhook Idempotency | 26–36 | Order creation, HMAC signature verification, duplicate webhook replay protection |
| **Part 3** | Social Features (Likes, Bookmarks, Follows) | 37–46 | Free actions, single-like compound constraint, idempotent bookmarking |
| **Part 4** | 50/50 Creator Economics & Masked Payouts | 47–58 | 50% split, 0% author self-support, double-entry ledger, masked bank/UPI accounts |
| **Part 5** | Admin Dashboard & Live Metrics | 59–70 | Real DB aggregation, Founder direct publishing, secret key timing-safe auth |
| **Part 6** | Email OTP & Password Reset Lifecycle | 71–98 | 6-digit generation, PBKDF2 hashing, 60s cooldown, 5-attempt lock, 60m reset token |
| **Part 7** | Multi-Signal Ranking & Discovery | 99–120 | Meaningful engagement, conversation depth, half-life decay, author diversity |
| **Part 8** | Direct Messaging & Privacy Threads | 121–135 | Canonical participant pairs `(p1, p2)`, message delivery, unread tracking |
| **Part 9** | Media Security & Magic-Byte Inspection | 136–142 | PNG, JPEG, GIF, WebP binary headers, rejection of disguised scripts |
| **Part 10**| Free Opinions & Fair Multi-Signal Feed | 143–157 | ₹0 instant publish, unengaged whale vs engaged free post outranking |
| **Part 11**| Server-Authoritative Founder Governance | 158–170 | Email normalization, client privilege stripping, Founder immunity |
| **Part 12**| Admin Secret Key & Endpoint Security | 171–180 | Timing-safe header checks (`x-admin-secret`, `x-admin-key`), generic 403 errors |
| **Part 13**| Economic Invariants & Discovery Lock | 181–193 | 5000 bps ledger records, 3 feed modes (`for_you`, `trending`, `following`), USD format |

---

## 3. Pre-Deployment Verification Checklist

Before deploying any refactoring or feature update, all five verification gates must pass:

1. `npx prisma validate` $\rightarrow$ Validates schema syntax and relational model.
2. `npx prisma migrate status` $\rightarrow$ Confirms database schema is fully up to date.
3. `npx tsc --noEmit` $\rightarrow$ Confirms 0 TypeScript errors across the entire codebase.
4. `npx tsx tests/run-all-tests.ts` $\rightarrow$ Confirms 193/193 tests pass (0 failures, 0 skipped).
5. `npm run build` $\rightarrow$ Confirms Next.js production build succeeds with all routes compiled.
