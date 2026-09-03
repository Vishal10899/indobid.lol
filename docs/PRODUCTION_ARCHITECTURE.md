# INDOBID — PRODUCTION ARCHITECTURE SPECIFICATION
**Health Monitoring, Global Currency & Infrastructure Operations Guide**

This document serves as the authoritative operational and architectural reference for the IndoBid production deployment, covering server availability, internationalization, multi-currency processing, and infrastructure safety.

---

## Table of Contents
1. [Database Connection Configuration](#1-where-database-connection-is-configured)
2. [Prisma Configuration](#2-where-prisma-is-configured)
3. [Database Schema Definition](#3-where-database-schema-lives)
4. [Database Migrations](#4-where-migrations-live)
5. [Authentication Architecture](#5-where-authentication-lives)
6. [Payment Processing Architecture](#6-where-payment-logic-lives)
7. [Razorpay Payment Gateway Adapter](#7-where-razorpay-integration-lives)
8. [Creator Economics & Earnings Ledger](#8-where-creator-economics-lives)
9. [Feed Algorithms & Conviction Ranking](#9-where-feed-algorithms-live)
10. [Global Currency Service](#10-where-currency-logic-lives)
11. [Country to Currency Mapping](#11-where-country-mapping-lives)
12. [Health Check Endpoints](#12-where-health-endpoint-lives)
13. [Production Health Monitoring & External Heartbeats](#13-how-production-health-monitoring-works)
14. [Inspecting the Production PostgreSQL Database](#14-how-to-inspect-the-production-postgresql-database)
15. [Safe Migration Execution](#15-how-to-safely-run-migrations)
16. [Disaster Recovery & Rollback Strategy](#16-how-to-rollbackrecover)
17. [Required Environment Variables](#17-which-environment-variables-are-required)
18. [Secret Management & Leak Prevention](#18-which-secrets-must-never-be-committed)
19. [Local Verification & Automated Testing](#19-how-to-test-the-complete-system-locally)
20. [Production Deployment Verification](#20-how-to-verify-the-production-deployment)

---

## 1. Where Database Connection is Configured
* **File:** [`src/infrastructure/database/prisma.ts`](file:///D:/indobid.lol/src/infrastructure/database/prisma.ts)
* **Configuration:** Connected to PostgreSQL 16 hosted on Render (`dpg-da7cea942hec73b16020-a.ohio-postgres.render.com`).
* **Environment Variable:** `DATABASE_URL` specified in `.env`.
* **Resilience Pattern:** [`src/infrastructure/database/transactions.ts`](file:///D:/indobid.lol/src/infrastructure/database/transactions.ts) provides the `safeDb()` higher-order execution wrapper that automatically retries failed queries with exponential backoff on cold starts or transient `P1017` connection drops.

## 2. Where Prisma is Configured
* **Configuration File:** [`prisma/schema.prisma`](file:///D:/indobid.lol/prisma/schema.prisma)
* **Client Generation:** Generates the typed `@prisma/client` inside `node_modules/@prisma/client` via `npx prisma generate`.
* **Generator:** `prisma-client-js` with engine binary caching.

## 3. Where Database Schema Lives
* **Location:** [`prisma/schema.prisma`](file:///D:/indobid.lol/prisma/schema.prisma)
* **Entities:** 24 models including `User`, `Debate`, `Contribution`, `Payment`, `CreatorEarningsLedger`, `PayoutAccount`, `DebateLike`, `DebateBookmark`, `Follow`, and `DirectMessage`.
* **Recent Schema Additions:**
  * `User`: `countryCode` (String, default `'IN'`, mapped to `country_code`) and `currencyCode` (String, default `'INR'`, mapped to `currency_code`).
  * `Payment`: `baseAmount` (Int, base currency minor units, mapped to `base_amount`), `baseCurrency` (String, default `'INR'`, mapped to `base_currency`), and `countryCode` (String, mapped to `country_code`).

## 4. Where Migrations Live
* **Location:** [`prisma/migrations/`](file:///D:/indobid.lol/prisma/migrations/)
* **History:**
  * `00000000000000_baseline/migration.sql`: Core baseline tables.
  * `20260904000000_add_country_and_currency/migration.sql`: Additive migration adding `country_code`, `currency_code` to users, and `base_amount`, `base_currency`, `country_code` to payments.

## 5. Where Authentication Lives
* **Module Directory:** [`src/modules/auth/`](file:///D:/indobid.lol/src/modules/auth/)
* **Key Components:**
  * Password Hashing: [`password.service.ts`](file:///D:/indobid.lol/src/modules/auth/password.service.ts) (Salted PBKDF2 with SHA-256).
  * Session Tokens: [`session.service.ts`](file:///D:/indobid.lol/src/modules/auth/session.service.ts) (HMAC-SHA256 tokens stored in `HttpOnly` cookies).
  * Email OTP: [`otp.service.ts`](file:///D:/indobid.lol/src/modules/auth/otp.service.ts) (Cryptographic 6-digit codes with 10m expiry and 5-attempt lockout).
  * Password Reset: [`password-reset.service.ts`](file:///D:/indobid.lol/src/modules/auth/password-reset.service.ts).
  * Authorization: [`authorization.ts`](file:///D:/indobid.lol/src/modules/auth/authorization.ts) (Founder check locked to `ADMIN_EMAIL`, timing-safe admin secret validation).

## 6. Where Payment Logic Lives
* **Module Directory:** [`src/modules/payments/`](file:///D:/indobid.lol/src/modules/payments/)
* **Service:** [`payment.service.ts`](file:///D:/indobid.lol/src/modules/payments/payment.service.ts)
* **Authoritative Fulfillment:** [`src/lib/payments/fulfillment.ts`](file:///D:/indobid.lol/src/lib/payments/fulfillment.ts)
* **Guarantees:** Atomic, idempotent database transactions that prevent duplicate contributions and double-crediting.

## 7. Where Razorpay Integration Lives
* **Adapter File:** [`src/infrastructure/payments/razorpay.adapter.ts`](file:///D:/indobid.lol/src/infrastructure/payments/razorpay.adapter.ts)
* **Metadata Sanitizer:** [`src/infrastructure/payments/payment-metadata.ts`](file:///D:/indobid.lol/src/infrastructure/payments/payment-metadata.ts)
* **Contract:** Implements [`IPaymentProvider`](file:///D:/indobid.lol/src/infrastructure/payments/payment.provider.interface.ts).
* **Isolation:** Isolates order generation, checkout session initialization, payment signature verification, and webhook HMAC validation.
* **UTF-8 & Notes Protection:** All order payloads pass through `buildSafeRazorpayNotes()`. Arbitrary user-generated text, post titles, bio, and content are strictly excluded from Razorpay notes. Only sanitized identifiers (`debate_id`, `contribution_id`, `country_code`, `currency`, `amount`) are sent to Razorpay. Unpaired UTF-16 surrogates and control characters are stripped from external payloads, completely preventing Razorpay UTF-8 encoding failures while keeping the original emojis, Hindi, and Unicode 100% intact in the PostgreSQL database.

## 8. Where Creator Economics Lives
* **Module Directory:** [`src/modules/creator-earnings/`](file:///D:/indobid.lol/src/modules/creator-earnings/)
* **Service:** [`earnings.service.ts`](file:///D:/indobid.lol/src/modules/creator-earnings/earnings.service.ts)
* **Invariants:**
  * Strict 50/50 revenue split: 5,000 bps (50%) to creator, 5,000 bps (50%) to platform fee.
  * Self-Support Exclusion: 0% creator rewards when an author backs their own post.
  * Immutable Double-Entry Ledger: Persisted in `CreatorEarningsLedger`.

## 9. Where Feed Algorithms Live
* **Module Directory:** [`src/modules/feed/`](file:///D:/indobid.lol/src/modules/feed/)
* **Algorithms:**
  * For You: [`algorithms/for-you.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/for-you.ts) (Multi-signal ranking + author diversity spacing).
  * Trending: [`algorithms/trending.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/trending.ts) (24-hour and 7-day velocity decay).
  * Following: [`algorithms/following.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/following.ts) (Creator affinity subscription feed).
* **Anti-Whale Dampening:** [`signals/conviction.ts`](file:///D:/indobid.lol/src/modules/feed/signals/conviction.ts) ($10 \cdot \log_{10}(1 + \text{paise}/1000)$).

## 10. Where Currency Logic Lives
* **Module Directory:** [`src/lib/money/`](file:///D:/indobid.lol/src/lib/money/)
* **Currencies Definition:** [`currencies.ts`](file:///D:/indobid.lol/src/lib/money/currencies.ts) (`BASE_CURRENCY = 'INR'`, `BASE_MINIMUM_SUPPORT = 10` INR / 1000 paise).
* **Exchange Rate Service:** [`exchange-rate.ts`](file:///D:/indobid.lol/src/lib/money/exchange-rate.ts) (Cached snapshot with cross-rate conversion via base INR).
* **Minimum Support Enforcement:** [`minimum-support.ts`](file:///D:/indobid.lol/src/lib/money/minimum-support.ts) (Enforces ₹10 INR purchasing power floor across foreign currencies).
* **Formatting:** [`money.ts`](file:///D:/indobid.lol/src/lib/money/money.ts) (`formatCurrencyAmount`, `formatINR`, `formatUSD`).

## 11. Where Country Mapping Lives
* **File:** [`src/lib/money/country-currency.ts`](file:///D:/indobid.lol/src/lib/money/country-currency.ts)
* **Supported Mappings:**
  * India (`IN`) $\rightarrow$ `INR`
  * United States (`US`) $\rightarrow$ `USD`
  * United Kingdom (`GB`) $\rightarrow$ `GBP`
  * Germany (`DE`) $\rightarrow$ `EUR`
  * Canada (`CA`) $\rightarrow$ `CAD`
  * Australia (`AU`) $\rightarrow$ `AUD`
  * France (`FR`), Italy (`IT`), Spain (`ES`), Netherlands (`NL`) $\rightarrow$ `EUR`
  * Japan (`JP`) $\rightarrow$ `JPY`
  * Singapore (`SG`) $\rightarrow$ `SGD`
  * United Arab Emirates (`AE`) $\rightarrow$ `AED`

## 12. Where Health Endpoint Lives
* **Liveness & DB Connectivity:** [`src/app/api/health/route.ts`](file:///D:/indobid.lol/src/app/api/health/route.ts)
* **Deep Database Health Probe:** [`src/app/api/health/db/route.ts`](file:///D:/indobid.lol/src/app/api/health/db/route.ts)
* **Response Contracts:**
  * Healthy (200 OK):
    ```json
    {
      "status": "ok",
      "service": "indobid",
      "timestamp": "2026-09-04T03:22:00.000Z",
      "database": "connected"
    }
    ```
  * Unhealthy (503 Service Unavailable):
    ```json
    {
      "status": "error",
      "service": "indobid",
      "timestamp": "2026-09-04T03:22:00.000Z",
      "database": "disconnected",
      "error": "Database service unavailable"
    }
    ```

## 13. How Production Health Monitoring Works
> [!IMPORTANT]
> An internal application endpoint cannot wake itself up or monitor its own crash loops. Production health monitoring must be triggered by an **EXTERNAL MONITORING SERVICE**.

1. **Recommended External Monitoring Services:**
   * Better Uptime / Better Stack
   * Pingdom
   * UptimeRobot
   * Render Managed Health Checks
2. **Configuration Settings:**
   * **Target URL:** `https://indobid.lol/api/health`
   * **HTTP Method:** `GET` or `HEAD`
   * **Interval:** Every 3 to 5 minutes (e.g. 180–300 seconds).
   * **Expected Status Code:** `200`
   * **Request Timeout:** 5,000 ms (5 seconds).
3. **Benefits of this Interval:**
   * Prevents Render web services from spinning down due to inactivity.
   * Keeps PostgreSQL connection pools warm.
   * Discovers database network partitioning or outages within 3 minutes.
   * Does not create analytics entries, notifications, or database records.

## 14. How to Inspect the Production PostgreSQL Database
1. **Via CLI (`psql`):**
   ```bash
   psql "$DATABASE_URL"
   ```
2. **Querying Essential Invariants:**
   ```sql
   -- View latest 10 payments and base currency values
   SELECT id, provider, amount, currency, base_amount, base_currency, country_code, status, created_at 
   FROM payments 
   ORDER BY created_at DESC LIMIT 10;

   -- Check 50/50 creator ledger balance
   SELECT creator_username, status, gross_amount_paise, creator_reward_paise, platform_fee_paise 
   FROM creator_earnings_ledger 
   ORDER BY created_at DESC LIMIT 10;

   -- Check user countries and currencies
   SELECT id, username, email, country_code, currency_code, role, created_at 
   FROM users 
   ORDER BY created_at DESC LIMIT 10;
   ```
3. **Via Prisma Studio (Local):**
   ```bash
   npx prisma studio
   ```

## 15. How to Safely Run Migrations
> [!CAUTION]
> NEVER execute `npx prisma migrate reset` or `npx prisma db push --force-reset` on production! These commands permanently drop database tables and destroy production user accounts, payments, and financial ledgers.

**Production Migration Procedure:**
1. Generate the migration locally or via schema diff:
   ```bash
   npx prisma migrate dev --name <migration_name> --create-only
   ```
2. Review the generated `migration.sql` for additive safety (e.g. `ADD COLUMN IF NOT EXISTS`).
3. Deploy migrations to the remote database safely:
   ```bash
   npx prisma migrate deploy
   ```
4. Verify migration status:
   ```bash
   npx prisma migrate status
   ```

## 16. How to Rollback/Recover
1. **Application Code Rollback:**
   * Revert git commit via `git revert <commit-hash>`.
   * Re-deploy previous build. Schema additions (`country_code`, `currency_code`) are nullable/defaulted and backwards-compatible with older code.
2. **Database Point-in-Time Recovery (PITR):**
   * Render PostgreSQL retains automated continuous WAL archives.
   * In the Render Dashboard, select Database $\rightarrow$ Backups $\rightarrow$ Restore to Point in Time.
3. **Financial Ledger Deterministic Replay:**
   * If a ledger inconsistency occurs, reconstruct creator balances deterministically by querying all `Payment` rows where `status = 'succeeded'` and replaying the 50/50 calculation in [`src/lib/payments/fulfillment.ts`](file:///D:/indobid.lol/src/lib/payments/fulfillment.ts).

## 17. Which Environment Variables are Required

| Variable | Description | Example / Location |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `SESSION_SECRET` | HMAC signing secret for cookies | Cryptographic 64+ char string |
| `ADMIN_EMAIL` | Authoritative founder email | `vishalkumar75912@gmail.com` |
| `ADMIN_SECRET_KEY` | Admin authorization token | High-entropy secret |
| `RAZORPAY_KEY_ID` | Razorpay public key ID | `rzp_live_...` or `rzp_test_...` |
| `RAZORPAY_KEY_SECRET`| Razorpay private key secret | Secret from Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature HMAC key | Secret configured in webhook settings |
| `RESEND_API_KEY` | Transactional email provider API key| `re_...` |
| `NEXT_PUBLIC_APP_URL` | Fully qualified public URL | `https://indobid.lol` |

## 18. Which Secrets Must NEVER Be Committed
* **`.env` files:** `.env`, `.env.local`, `.env.production` are strictly gitignored in `.gitignore`.
* **Database Credentials:** Passwords, usernames, and database ports.
* **Payment Secrets:** `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
* **Cryptographic Keys:** `SESSION_SECRET` and `ADMIN_SECRET_KEY`.
* **Audit Enforcement:** In [`src/infrastructure/logging/logger.ts`](file:///D:/indobid.lol/src/infrastructure/logging/logger.ts), automated masking redacts any key containing `key`, `secret`, `password`, `token`, or `credential`.

## 19. How to Test the Complete System Locally
Execute the end-to-end automated regression test suite:
```powershell
npx tsx tests/run-all-tests.ts
```
Expected output:
```text
====================================================
  TEST RESULTS: TOTAL: 215 | PASSED: 215 | FAILED: 0 | SKIPPED: 0
====================================================
```

## 20. How to Verify the Production Deployment
Execute the complete verification pipeline in order:
```powershell
# 1. Validate Prisma schema syntax
npx prisma validate

# 2. Confirm database migrations are applied
npx prisma migrate status

# 3. Check for TypeScript compilation issues
npx tsc --noEmit

# 4. Run automated test suite
npx tsx tests/run-all-tests.ts

# 5. Build Next.js production bundle
npm run build

# 6. Verify health endpoints via cURL
curl -i https://indobid.lol/api/health
curl -i https://indobid.lol/api/health/db
```
* Status codes must return `200 OK`.
* No sensitive environment variables or database credentials must appear in response payloads.
