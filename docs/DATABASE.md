# INDOBID — DATABASE & PERSISTENCE SPECIFICATION

---

## 1. Engine & Stack
* **Database Engine**: PostgreSQL (Managed Cloud Instance over TLS 1.3, port 5432)
* **ORM**: Prisma ^6.4.1
* **Schema Definition**: [`prisma/schema.prisma`](file:///D:/indobid.lol/prisma/schema.prisma)
* **Client Singleton**: [`src/infrastructure/database/prisma.ts`](file:///D:/indobid.lol/src/infrastructure/database/prisma.ts)
* **Cold-Start Retry Wrapper**: [`src/infrastructure/database/transactions.ts`](file:///D:/indobid.lol/src/infrastructure/database/transactions.ts) (`safeDb`)

---

## 2. Model Catalog (24 Relational Models)

| # | Model Name | SQL Table Name | Primary Purpose | Key Indexes & Constraints |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `User` | `users` | User credentials, roles, profile stats | `@unique([email])`, `@unique([username])` |
| **2** | `Category` | `categories` | 49 discussion taxonomy topics | `@unique([slug])`, `@unique([name])` |
| **3** | `Debate` | `debates` | Main opinion / debate posts | `@@index([status, trendingScore(Desc)])` |
| **4** | `Contribution` | `contributions` | Multi-turn sequential arguments | `@@index([debateId, status, sequence])` |
| **5** | `DebateActivityEvent` | `debate_activity_events` | Public live conviction feed | `@@index([debateId, createdAt(Desc)])` |
| **6** | `DebateLike` | `debate_likes` | User like / reaction links | `@@unique([debateId, userId])` |
| **7** | `DebateBookmark` | `debate_bookmarks` | User saved posts library | `@@unique([debateId, userId])` |
| **8** | `DebateImpression` | `debate_impressions` | Unique view / read counts | `@@unique([debateId, sessionToken])` |
| **9** | `DebateReport` | `debate_reports` | Moderation report tickets | `@@index([status, createdAt(Desc)])` |
| **10** | `Follow` | `follows` | User social relationship graph | `@@unique([followerId, followingId])` |
| **11** | `EmailOtp` | `email_otps` | 6-digit email verification codes | `@@index([email, expiresAt])` |
| **12** | `PasswordResetToken` | `password_reset_tokens` | 32-byte cryptographic reset tokens | `@@index([token])`, `@@index([email])` |
| **13** | `Payment` | `payments` | Razorpay transaction records | `@unique([providerPaymentId])` |
| **14** | `CreatorEarningsLedger` | `creator_earnings_ledger` | Immutable 50/50 revenue ledger | `@@unique([contributionId, idempotencyKey])` |
| **15** | `PayoutAccount` | `payout_accounts` | Masked Bank/UPI payout details | `@unique([userId])` |
| **16** | `Conversation` | `conversations` | 1-to-1 direct message threads | `@@unique([participant1Id, participant2Id])` |
| **17** | `DirectMessage` | `direct_messages` | Private message contents | `@@index([conversationId, createdAt])` |
| **18** | `Notification` | `notifications` | User activity notifications | `@@index([userId, isRead, createdAt])` |
| **19** | `VisitorSession` | `visitor_sessions` | Real-time active tab tracking | `@@index([lastSeenAt])` |
| **20** | `ListingVisit` | `listing_visits` | Analytics visits tracking | `@@index([listingId, createdAt])` |
| **21** | `Listing` | `listings` | Legacy marketplace model | `@@index([status, createdAt])` |
| **22** | `Bid` | `bids` | Legacy marketplace bidding model | `@@index([listingId, status])` |
| **23** | `Click` | `clicks` | Legacy click tracker model | `@@index([listingId, createdAt])` |
| **24** | `TopUp` | `topups` | Legacy wallet top-up model | `@unique([providerPaymentId])` |

---

## 3. Data Access Layer (Repositories)
All database queries are owned exclusively by repository classes under `src/infrastructure/database/repositories/`. Services must never write ad-hoc queries directly.
