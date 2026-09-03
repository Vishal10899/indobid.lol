# INDOBID — DATABASE SCHEMA & DATA ARCHITECTURE DOCUMENTATION

**Document Version:** 2.0.0  
**Status:** Authoritative Production Reference  
**Database Engine:** PostgreSQL 16 (Hosted on Render Managed DB: `dpg-da7cea942hec73b16020-a.ohio-postgres.render.com`)  
**ORM:** Prisma ORM 5.x with Transaction Client Integration  

---

## 1. High-Level Architectural Overview

The IndoBid database stores all persistent state for opinions/debates, financial backing records, sequential discussion contributions, immutable creator earnings ledgers, social interactions (likes, bookmarks, follows, comments, shares), direct messages, authentication records (sessions, hashed credentials, OTPs, password reset tokens), moderation reports, and visitor telemetry.

All financial fields are stored strictly as **integer paise** (`1 INR = 100 paise`, with a `$2 USD = 200 paise` minimum conversion constant) to eliminate IEEE 754 floating-point rounding inaccuracies.

---

## 2. Table-by-Table Schema Breakdown

### 2.1 `users`
* **Purpose:** Core identity table for registered creators, supporters, administrators, and the Founder.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): Unique CUID identifier.
  * `email` (`VARCHAR(255)`, Unique, Nullable): Canonical lowercased email address.
  * `username` (`VARCHAR(50)`, Unique): Canonical lowercased alphanumeric username.
  * `displayName` (`VARCHAR(100)`): Public display name.
  * `passwordHash` (`VARCHAR(255)`, Nullable): Salted PBKDF2 (SHA-256) password hash.
  * `avatarUrl` (`VARCHAR(500)`, Nullable): Media path or storage reference.
  * `bio` (`TEXT`, Nullable): Creator biography / tagline.
  * `isVerified` (`BOOLEAN`, Default: `false`): Verification checkmark status.
  * `isSuspended` (`BOOLEAN`, Default: `false`): Administrative suspension flag.
  * `emailVerifiedAt` (`TIMESTAMPTZ`, Nullable): Timestamp of successful email OTP verification.
  * `role` (`VARCHAR(20)`, Default `'user'`): Authorization tier (`user`, `admin`, `founder`).
  * `rank` (`INTEGER`, Default `0`): Gamification / contributor rank.
  * `createdAt` / `updatedAt` (`TIMESTAMPTZ`): Temporal audit timestamps.
* **Indices:**
  * `UNIQUE INDEX users_email_key ON users(email)`
  * `UNIQUE INDEX users_username_key ON users(username)`
  * `INDEX users_role_idx ON users(role)`
  * `INDEX users_createdAt_idx ON users(createdAt)`

---

### 2.2 `debates`
* **Purpose:** Primary discussion topics, published opinions, or thesis statements created by creators.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `title` (`VARCHAR(255)`): Debate headline / opinion title.
  * `content` (`TEXT`): Main opening thesis / argument text (min 5, max 3000 chars).
  * `authorId` (`VARCHAR(30)`, FK -> `users.id`, Nullable): Author relation (null if anonymous or guest).
  * `authorUsername` (`VARCHAR(50)`): Author username or `'anonymous'`.
  * `authorDisplayName` (`VARCHAR(100)`): Author display name or `'Anonymous'`.
  * `isAnonymous` (`BOOLEAN`, Default: `false`): Public anonymity flag.
  * `categoryId` (`VARCHAR(30)`, FK -> `categories.id`): Topic taxonomy relation.
  * `hashtags` (`VARCHAR(255)`, Nullable): Space-separated discovery tags.
  * `originalContribution` (`INTEGER`, Default `0`): Initial backing stake in integer paise (₹0 for free posts).
  * `totalVerifiedContribution` (`INTEGER`, Default `0`): Cumulative verified backing in paise.
  * `contributionCount` (`INTEGER`, Default `0`): Total verified sequence contributions count.
  * `lastContributionAmount` (`INTEGER`, Default `0`): Highest / most recent contribution in paise.
  * `lastContributionAt` (`TIMESTAMPTZ`, Nullable): Timestamp of latest paid reply.
  * `trendingScore` (`DOUBLE PRECISION`, Default `0.0`): Dynamic momentum & quality ranking score.
  * `likeCount` (`INTEGER`, Default `0`): Aggregate cached likes.
  * `impressionCount` (`INTEGER`, Default `0`): Aggregate view impressions.
  * `status` (`VARCHAR(20)`, Default `'pending_payment'`): Lifecycle status (`pending_payment`, `active`, `hidden`, `removed`).
  * `createdAt` / `updatedAt` (`TIMESTAMPTZ`): Audit timestamps.
* **Indices:**
  * `INDEX debates_status_trendingScore_idx ON debates(status, trendingScore DESC)`
  * `INDEX debates_status_totalVerifiedContribution_idx ON debates(status, totalVerifiedContribution DESC)`
  * `INDEX debates_categoryId_status_idx ON debates(categoryId, status)`
  * `INDEX debates_authorUsername_status_idx ON debates(authorUsername, status)`
  * `INDEX debates_createdAt_idx ON debates(createdAt DESC)`

---

### 2.3 `contributions`
* **Purpose:** Chronological, sequential perspectives or paid backing responses. Sequence #1 is the author's opening post.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `debateId` (`VARCHAR(30)`, FK -> `debates.id`, ON DELETE CASCADE): Parent debate relation.
  * `authorId` (`VARCHAR(30)`, FK -> `users.id`, Nullable): Responding user.
  * `authorUsername` (`VARCHAR(50)`): Responding username or `'anonymous'`.
  * `authorDisplayName` (`VARCHAR(100)`): Responding display name.
  * `isAnonymous` (`BOOLEAN`, Default: `false`): Anonymity flag.
  * `amount` (`INTEGER`): Contribution value in integer paise.
  * `sequence` (`INTEGER`): Strictly increasing sequence number within the debate (`1, 2, 3...`).
  * `content` (`TEXT`): Argument or continuation text.
  * `status` (`VARCHAR(20)`, Default `'pending_payment'`): State (`pending_payment`, `verified`, `failed`, `canceled`).
  * `providerPaymentId` (`VARCHAR(100)`, Nullable): Razorpay payment ID reference.
  * `verifiedAt` (`TIMESTAMPTZ`, Nullable): Timestamp when payment verified.
  * `createdAt` (`TIMESTAMPTZ`): Creation timestamp.
* **Indices:**
  * `INDEX contributions_debateId_status_sequence_idx ON contributions(debateId, status, sequence ASC)`
  * `INDEX contributions_authorUsername_status_idx ON contributions(authorUsername, status)`
  * `INDEX contributions_providerPaymentId_idx ON contributions(providerPaymentId)`

---

### 2.4 `payments`
* **Purpose:** Audit log of payment attempts and gateway transactions.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `providerPaymentId` (`VARCHAR(100)`, Unique): Razorpay `pay_...` ID.
  * `orderId` (`VARCHAR(100)`, Nullable): Razorpay `order_...` ID.
  * `amount` (`INTEGER`): Value in integer paise.
  * `currency` (`VARCHAR(10)`, Default `'INR'`): Currency code.
  * `status` (`VARCHAR(20)`): State (`pending`, `succeeded`, `failed`, `canceled`).
  * `method` (`VARCHAR(50)`, Nullable): Payment instrument (`card`, `upi`, `netbanking`).
  * `debateId` (`VARCHAR(30)`, FK -> `debates.id`, Nullable): Associated debate.
  * `contributionId` (`VARCHAR(30)`, FK -> `contributions.id`, Nullable): Associated contribution.
  * `userId` (`VARCHAR(30)`, FK -> `users.id`, Nullable): Payer identity.
  * `notes` (`JSONB`, Nullable): Metadata payload.
  * `createdAt` / `updatedAt` (`TIMESTAMPTZ`).
* **Indices:**
  * `UNIQUE INDEX payments_providerPaymentId_key ON payments(providerPaymentId)`
  * `INDEX payments_status_createdAt_idx ON payments(status, createdAt DESC)`
  * `INDEX payments_debateId_idx ON payments(debateId)`
  * `INDEX payments_userId_idx ON payments(userId)`

---

### 2.5 `creator_earnings_ledgers`
* **Purpose:** Authoritative, immutable double-entry ledger recording the 50/50 revenue split and self-support exclusions.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `contributionId` (`VARCHAR(30)`, Unique, FK -> `contributions.id`): 1-to-1 link ensuring strict idempotency.
  * `creatorUsername` (`VARCHAR(50)`): Author receiving creator reward.
  * `creatorUserId` (`VARCHAR(30)`, FK -> `users.id`, Nullable): Creator user record.
  * `grossAmountPaise` (`INTEGER`): Total contribution amount in paise.
  * `creatorRewardPaise` (`INTEGER`): 50% author share in paise (0 if author self-supports).
  * `platformFeePaise` (`INTEGER`): 50% platform fee in paise (100% if self-supported).
  * `rateBps` (`INTEGER`, Default `5000`): Revenue share rate in basis points (5000 = 50.00%).
  * `status` (`VARCHAR(20)`, Default `'pending'`): Status (`pending`, `available`, `paid`, `reversed`).
  * `idempotencyKey` (`VARCHAR(100)`, Unique): Deterministic hash preventing duplicate attribution.
  * `reversedAt` (`TIMESTAMPTZ`, Nullable): Timestamp of refund/chargeback reversal.
  * `reversalReason` (`TEXT`, Nullable): Cause of reversal.
  * `createdAt` (`TIMESTAMPTZ`): Creation timestamp.
* **Indices:**
  * `UNIQUE INDEX creator_earnings_ledgers_contributionId_key ON creator_earnings_ledgers(contributionId)`
  * `UNIQUE INDEX creator_earnings_ledgers_idempotencyKey_key ON creator_earnings_ledgers(idempotencyKey)`
  * `INDEX creator_earnings_ledgers_creatorUsername_status_idx ON creator_earnings_ledgers(creatorUsername, status)`

---

### 2.6 `payout_accounts`
* **Purpose:** Masked bank account and UPI routing for creator earnings disbursements.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `userId` (`VARCHAR(30)`, Unique, FK -> `users.id`): Linked creator.
  * `accountType` (`VARCHAR(20)`): `'bank_account'` or `'upi'`.
  * `accountHolderName` (`VARCHAR(100)`): Legal name of beneficiary.
  * `maskedAccountNumber` (`VARCHAR(50)`): Format: `•••• 4821` or `vi••••@okhdfcbank`.
  * `maskedIfsc` (`VARCHAR(50)`, Nullable): Format: `HDFC•••••`.
  * `status` (`VARCHAR(20)`, Default `'verified'`): Status (`pending`, `verified`, `rejected`).
  * `verifiedAt` (`TIMESTAMPTZ`, Nullable).
  * `createdAt` / `updatedAt` (`TIMESTAMPTZ`).

---

### 2.7 `email_otps`
* **Purpose:** Cryptographically hashed 6-digit one-time passwords for signup and passwordless authentication.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `email` (`VARCHAR(255)`): Target user email.
  * `codeHash` (`VARCHAR(255)`): PBKDF2 hash of the 6-digit code.
  * `salt` (`VARCHAR(64)`): Random cryptographic salt.
  * `attempts` (`INTEGER`, Default `0`): Failed verification attempts (locks at >= 5).
  * `used` (`BOOLEAN`, Default `false`): Replay protection flag.
  * `expiresAt` (`TIMESTAMPTZ`): Hard 10-minute expiration deadline.
  * `createdAt` (`TIMESTAMPTZ`): Timestamp of generation.
* **Indices:**
  * `INDEX email_otps_email_used_expiresAt_idx ON email_otps(email, used, expiresAt DESC)`

---

### 2.8 `password_reset_tokens`
* **Purpose:** Hashed single-use tokens for password recovery.
* **Columns:**
  * `id` (`VARCHAR(30)`, PK): CUID identifier.
  * `email` (`VARCHAR(255)`): User email address.
  * `tokenHash` (`VARCHAR(255)`): PBKDF2 hash of 64-character random token.
  * `salt` (`VARCHAR(64)`): Cryptographic salt.
  * `used` (`BOOLEAN`, Default `false`): Invalidation flag upon consumption.
  * `expiresAt` (`TIMESTAMPTZ`): Hard 60-minute expiration deadline.
  * `createdAt` (`TIMESTAMPTZ`).
* **Indices:**
  * `INDEX password_reset_tokens_email_used_idx ON password_reset_tokens(email, used)`

---

### 2.9 Social & Moderation Entities
* **`follows`:** `(followerId, followingId)` unique compound key enforcing unidirectional subscriptions.
* **`debate_likes`:** `(debateId, userId)` unique compound key enforcing single-like constraint.
* **`debate_bookmarks`:** `(debateId, userId)` unique compound key enforcing single-bookmark constraint.
* **`debate_reports`:** Reports on malicious or policy-violating opinions. Feeds moderation queue and applies ranking score penalties.
* **`direct_messages` & `conversations`:** Private encrypted-at-rest participant discussions with compound participant ordering.
* **`debate_activity_events`:** Event audit stream recording contributions, likes, and milestones.
* **`debate_impressions`:** Deduplicated view count tracking per visitor session.

---

## 3. Data Safety & Migration Guidelines

1. **Destructive Command Ban:** `prisma migrate reset`, `prisma db push --force-reset`, and direct `DROP TABLE` commands are strictly forbidden in all deployment environments.
2. **Backward-Compatible Schema Evolutions:** When adding columns, always supply default values or mark as nullable. Never rename a live column without an expand-and-contract migration strategy.
3. **Integer Money Guarantee:** All monetary arithmetic must operate on integer paise. Floating-point fractions must be rounded via `Math.floor()` for creator payouts to prevent infinite fractional inflation.
4. **Foreign Key Integrity:** Cascade deletes are reserved strictly for dependent sub-entities (`contributions` on debate delete). Financial ledgers and payment logs maintain permanent referential audit trails.
