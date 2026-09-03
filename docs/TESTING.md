# INDOBID — TESTING HARNESS SPECIFICATION

---

## 1. Test Suite Architecture
* **Harness Location**: [`tests/run-all-tests.ts`](file:///D:/indobid.lol/tests/run-all-tests.ts)
* **Execution Command**: `npx tsx tests/run-all-tests.ts`
* **Test Count**: 193 Automated Tests across 13 Subsystems
* **Current Baseline**: 100% Pass Rate (`193 / 193 PASSED`)

---

## 2. Test Subsystem Coverage Matrix
1. Core Monetary Arithmetic (Paise, USD formatting, minimums)
2. Creator Economics (50/50 split math, 0% author self-support)
3. Multi-Signal Ranking Algorithm & Anti-Whale Logarithms
4. 48-Hour Exponential Half-Life Momentum Decay
5. Password Hashing (PBKDF2-SHA512) & Salt Validation
6. Session HMAC Signature Token Validation
7. Timing-Safe Admin Secret Verification & IP Lockouts
8. Email OTP Generation & Cooldown Expiry
9. Password Reset Cryptographic Token Lifecycle
10. Sliding-Window Rate Limiting
11. Payment Fulfillment & ACID Database Transactions
12. Feed Discovery & Author Diversity Constraints
13. Admin Operations & Founder Immunity Protections
