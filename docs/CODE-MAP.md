# INDOBID — COMPREHENSIVE CODEBASE ARCHITECTURE MAP

**Document Version:** 2.0.0  
**Status:** Authoritative Code Navigation Guide  

---

## 1. Configuration (`src/config/`)

| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/config/env.ts` | Zod validation of all environment variables | `env`, `validateEnv` | Stateless |
| `src/config/app.ts` | Application constants, money limits, feed limits | `appConfig` | Stateless |
| `src/config/security.ts` | Cookie names, rate-limit thresholds, CORS settings | `securityConfig` | Stateless |

---

## 2. Infrastructure Layer (`src/infrastructure/`)

### 2.1 Database (`src/infrastructure/database/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/infrastructure/database/prisma.ts` | Singleton Prisma client instance | `prisma` | Stateful (Connection Pool) |
| `src/infrastructure/database/transactions.ts` | Safe transaction execution & retry wrapper | `safeDb`, `withTransaction` | Stateless |
| `src/infrastructure/database/repositories/user.repository.ts` | User table data access | `userRepository` | Stateless |
| `src/infrastructure/database/repositories/debate.repository.ts` | Debate queries, active filters, search | `debateRepository` | Stateless |
| `src/infrastructure/database/repositories/contribution.repository.ts` | Sequential discussion contribution queries | `contributionRepository` | Stateless |
| `src/infrastructure/database/repositories/payment.repository.ts` | Payment attempts & provider payment lookups | `paymentRepository` | Stateless |
| `src/infrastructure/database/repositories/ledger.repository.ts` | Creator earnings ledger queries & aggregations | `ledgerRepository` | Stateless |
| `src/infrastructure/database/repositories/category.repository.ts` | Taxonomy & topic lookups | `categoryRepository` | Stateless |
| `src/infrastructure/database/repositories/otp.repository.ts` | One-time password verification records | `otpRepository` | Stateless |
| `src/infrastructure/database/repositories/password-reset.repository.ts` | Password reset tokens | `passwordResetRepository` | Stateless |
| `src/infrastructure/database/repositories/payout-account.repository.ts` | Masked creator payout account management | `payoutAccountRepository` | Stateless |
| `src/infrastructure/database/repositories/message.repository.ts` | Direct message threads & participant conversations | `messageRepository` | Stateless |
| `src/infrastructure/database/repositories/visitor.repository.ts` | Visitor sessions & analytics | `visitorRepository` | Stateless |

### 2.2 Payments (`src/infrastructure/payments/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/infrastructure/payments/payment.provider.interface.ts` | Vendor-agnostic gateway interface | `IPaymentProvider`, `CreateOrderParams` | Stateless |
| `src/infrastructure/payments/razorpay.adapter.ts` | Razorpay implementation of IPaymentProvider | `RazorpayAdapter`, `razorpayAdapter` | Stateless |

### 2.3 Storage (`src/infrastructure/storage/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/infrastructure/storage/storage.interface.ts` | Generic storage contract | `IStorageProvider`, `StorageUploadParams` | Stateless |
| `src/infrastructure/storage/magic-bytes.ts` | Binary image header validation | `isValidImageMagicBytes` | Stateless |
| `src/infrastructure/storage/database.storage.ts` | Data URI / base64 database storage | `DatabaseStorageAdapter` | Stateless |
| `src/infrastructure/storage/local-storage.adapter.ts` | Local disk filesystem storage | `LocalStorageAdapter` | Stateless |
| `src/infrastructure/storage/s3-storage.adapter.ts` | S3 / Cloudflare R2 object storage | `S3StorageAdapter` | Stateless |

---

## 3. Domain Modules (`src/modules/`)

### 3.1 Authentication & Authorization (`src/modules/auth/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/modules/auth/password.service.ts` | PBKDF2 password hashing & verification | `hashPassword`, `verifyPassword` | Stateless |
| `src/modules/auth/session.service.ts` | HMAC-SHA256 session token generation & verification | `createSessionToken`, `getCurrentUser` | Stateless |
| `src/modules/auth/otp.service.ts` | 6-digit OTP generation, hashing, rate limits | `requestEmailOtp`, `verifyEmailOtp` | Stateless |
| `src/modules/auth/password-reset.service.ts` | Single-use password reset token management | `requestPasswordReset`, `resetPasswordWithToken` | Stateless |
| `src/modules/auth/authorization.ts` | Centralized RBAC, Founder & Admin checks | `isFounder`, `isAuthorizedAdmin`, `ADMIN_EMAIL` | Stateless |
| `src/modules/auth/auth.service.ts` | Signup, login, credential verification | `authService` | Stateless |

### 3.2 Debates & Posts (`src/modules/debates/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/modules/debates/debate.service.ts` | Post creation, retrieval, updates, momentum scores | `debateService`, `getDebates`, `getDebateById` | Stateless |
| `src/modules/debates/debate.policy.ts` | Permissions on editing, hiding, deleting | `debatePolicy` | Stateless |
| `src/modules/debates/debate.validation.ts` | Zod validation schemas for debates | `createDebateSchema` | Stateless |

### 3.3 Creator Economics (`src/modules/creator-earnings/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/modules/creator-earnings/earnings.service.ts` | 50/50 revenue split, self-support exclusion, ledgers | `earningsService`, `calculateCreatorEconomics` | Stateless |
| `src/modules/creator-earnings/payout.service.ts` | Bank account & UPI masking & management | `payoutService` | Stateless |

### 3.4 Feed & Ranking Engine (`src/modules/feed/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/modules/feed/feed.service.ts` | Unified feed query coordinator | `feedService` | Stateless |
| `src/modules/feed/ranking/ranking.service.ts` | Composite multi-signal ranking score calculator | `calculateRankingScore` | Stateless |
| `src/modules/feed/algorithms/for-you.ts` | For You personalized discovery algorithm | `forYouService` | Stateless |
| `src/modules/feed/algorithms/trending.ts` | Platform velocity trending algorithm | `calculateTrendingScore` | Stateless |
| `src/modules/feed/algorithms/following.ts` | Followed creator filtered feed | `followingFeedService` | Stateless |
| `src/modules/feed/signals/conviction.ts` | Logarithmic whale-dampened conviction | `calculateConvictionScore` | Stateless |
| `src/modules/feed/signals/freshness.ts` | Cold-start boost & half-life time decay | `calculateFreshnessBoost`, `calculateRecencyDecay` | Stateless |
| `src/modules/feed/signals/conversation.ts` | Conversation reply depth & participant score | `calculateConversationScore` | Stateless |
| `src/modules/feed/signals/diversity.ts` | Author diversity spacing constraint | `applyAuthorDiversity` | Stateless |

### 3.5 Social & Moderation (`src/modules/social/`, `src/modules/admin/`)
| File Path | Responsibility | Key Exports | Stateless/Stateful |
| :--- | :--- | :--- | :--- |
| `src/modules/social/likes/like.service.ts` | Free post liking & unliking | `likeService` | Stateless |
| `src/modules/social/bookmarks/bookmark.service.ts` | Free post saving & removal | `bookmarkService` | Stateless |
| `src/modules/social/follows/follow.service.ts` | User subscriptions & follower counts | `followService` | Stateless |
| `src/modules/social/messages/message.service.ts` | Private direct message conversations | `messageService` | Stateless |
| `src/modules/admin/admin.service.ts` | Platform statistics aggregation & moderation | `adminService` | Stateless |

---

## 4. API Routes (Thin Controllers — `src/app/api/`)

* `src/app/api/debates/route.ts`: Thin controller delegating to `debateService.getDebates` & `debateService.createDebate`.
* `src/app/api/debates/[id]/route.ts`: Thin controller delegating to `debateService.getDebateById` & `debateService.hide`.
* `src/app/api/admin/stats/route.ts`: Thin controller delegating to `adminService.getStatsMetrics`.
* `src/app/api/admin/debates/route.ts`: Thin controller delegating to `adminService.listDebates`.
* `src/app/api/admin/users/route.ts`: Thin controller delegating to `adminService.listUsers` & `adminService.moderateUser`.
* `src/app/api/admin/payments/route.ts`: Thin controller delegating to `adminService.listPayments`.
* `src/app/api/profile/payout-account/route.ts`: Thin controller delegating to `payoutService`.
* `src/app/api/messages/route.ts`: Thin controller delegating to `messageService`.
* `src/app/api/messages/[conversationId]/route.ts`: Thin controller delegating to `messageService`.
* `src/app/api/webhooks/razorpay/route.ts`: Webhook signature verification and ACID fulfillment via `paymentService.processSuccessfulPayment`.
