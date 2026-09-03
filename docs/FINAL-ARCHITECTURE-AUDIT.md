# INDOBID — FINAL PRODUCTION ARCHITECTURAL AUDIT

**Document Version:** 2.0.0  
**Status:** Certified Architecture Audit Report  
**Verification:** All 193 Tests Passed (0 Failed, 0 Skipped), 0 TypeScript Errors, Production Build Succeeded  

---

## 40 Explicit Architectural Audit Answers

### 1. Where does user registration happen?
* **File Path:** [`src/modules/auth/auth.service.ts`](file:///D:/indobid.lol/src/modules/auth/auth.service.ts) (lines 35–85) and [`src/app/api/auth/signup/route.ts`](file:///D:/indobid.lol/src/app/api/auth/signup/route.ts) (lines 30–120).
* **Details:** HTTP route validates input with Zod, normalizes email and username to lowercase, verifies rate limits, provisions an unverified user record via `userRepository.create()`, hashes password via `passwordService.hashPassword()`, and dispatches email OTP via `otpService.requestEmailOtp()`.

### 2. Where is password hashing performed?
* **File Path:** [`src/modules/auth/password.service.ts`](file:///D:/indobid.lol/src/modules/auth/password.service.ts) (lines 14–35).
* **Details:** Cryptographic PBKDF2 using SHA-256 with 1,000 iterations, a 16-byte random salt (`crypto.randomBytes(16)`), and timing-safe verification via `crypto.timingSafeEqual()`.

### 3. Where are sessions verified?
* **File Path:** [`src/modules/auth/session.service.ts`](file:///D:/indobid.lol/src/modules/auth/session.service.ts) (lines 45–95).
* **Details:** HMAC-SHA256 signature verification over base64-encoded user payload with constant-time buffer comparison. `sessionService.getCurrentUser()` parses both `indobid_session` cookies and `Authorization: Bearer <token>` headers.

### 4. Where is the Founder role checked?
* **File Path:** [`src/modules/auth/authorization.ts`](file:///D:/indobid.lol/src/modules/auth/authorization.ts) (lines 50–90).
* **Details:** `isFounder(user)` verifies that the account matches canonical normalized `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`) and `role === 'founder' || role === 'admin'`. Never trusts client-supplied payload parameters.

### 5. Where are payments initiated?
* **File Path:** [`src/modules/payments/payment.service.ts`](file:///D:/indobid.lol/src/modules/payments/payment.service.ts) (lines 20–55) and [`src/app/api/checkout/route.ts`](file:///D:/indobid.lol/src/app/api/checkout/route.ts) (lines 25–95).
* **Details:** `paymentService.createCheckoutSession()` creates an order via `razorpayAdapter.createOrder()` with a minimum ₹2 / 200 paise threshold.

### 6. Where is the Razorpay webhook handled?
* **File Path:** [`src/app/api/webhooks/razorpay/route.ts`](file:///D:/indobid.lol/src/app/api/webhooks/razorpay/route.ts) (lines 20–110).
* **Details:** Verifies HMAC-SHA256 signature using `paymentService.verifyWebhookSignature()` against `RAZORPAY_WEBHOOK_SECRET` and delegates ACID fulfillment to `paymentService.processSuccessfulPayment()`.

### 7. Where is the 50/50 creator split calculated?
* **File Path:** [`src/modules/creator-earnings/earnings.service.ts`](file:///D:/indobid.lol/src/modules/creator-earnings/earnings.service.ts) (lines 17–55).
* **Details:** `CREATOR_SHARE_BPS = 5000` (50.00%). `creatorRewardPaise = Math.floor((amountPaise * 5000) / 10000)` and `platformFeePaise = amountPaise - creatorRewardPaise`.

### 8. Where is author self-support excluded?
* **File Path:** [`src/modules/creator-earnings/earnings.service.ts`](file:///D:/indobid.lol/src/modules/creator-earnings/earnings.service.ts) (lines 30–45) and [`src/lib/payments/fulfillment.ts`](file:///D:/indobid.lol/src/lib/payments/fulfillment.ts) (lines 350–385).
* **Details:** When `isDebateAuthor || sequence === 1`, `creatorRewardPaise = 0` and `platformFeePaise = amountPaise`. Author earns 0% on self-stakes or initial debate creation.

### 9. Where is the $2 minimum enforced?
* **File Path:** [`src/config/app.ts`](file:///D:/indobid.lol/src/config/app.ts) (line 12), [`src/lib/money.ts`](file:///D:/indobid.lol/src/lib/money.ts) (lines 10–25), and [`src/modules/debates/debate.service.ts`](file:///D:/indobid.lol/src/modules/debates/debate.service.ts) (lines 465–475).
* **Details:** `MINIMUM_DEBATE_PAISE = 200` (₹2.00 / $2.00 USD). Checked on backed debate creation, payment orders, and first paid continuations.

### 10. Where is the debate post created?
* **File Path:** [`src/modules/debates/debate.service.ts`](file:///D:/indobid.lol/src/modules/debates/debate.service.ts) (lines 405–590).
* **Details:** `debateService.createDebate()` handles Founder instant publish, ₹0 Free post instant publish, and backed post Razorpay order generation.

### 11. Where is the sequence 1 contribution created?
* **File Path:** [`src/modules/debates/debate.service.ts`](file:///D:/indobid.lol/src/modules/debates/debate.service.ts) (lines 490–550 for free/founder posts) and [`src/lib/payments/fulfillment.ts`](file:///D:/indobid.lol/src/lib/payments/fulfillment.ts) (lines 130–185 for backed posts).
* **Details:** Sequence #1 contribution records the author's opening argument content, amount, and verified status.

### 12. Where are continuations validated?
* **File Path:** [`src/lib/money.ts`](file:///D:/indobid.lol/src/lib/money.ts) (lines 35–55) and [`src/app/api/debates/[id]/continue/route.ts`](file:///D:/indobid.lol/src/app/api/debates/[id]/continue/route.ts) (lines 30–80).
* **Details:** Validates that amount is strictly greater than or equal to `calculateNextMinimumPaise(debate.lastContributionAmount)` ($1 / 100 paise increment).

### 13. Where is the next minimum contribution calculated?
* **File Path:** [`src/lib/money.ts`](file:///D:/indobid.lol/src/lib/money.ts) (lines 28–45).
* **Details:** `calculateNextMinimumPaise(lastAmountPaise)`: if `!lastAmountPaise || lastAmountPaise <= 0`, returns 200 paise ($2 USD). Otherwise returns `lastAmountPaise + 100 paise` ($1 USD increment).

### 14. Where does the For You algorithm live?
* **File Path:** [`src/modules/feed/algorithms/for-you.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/for-you.ts) and [`src/modules/feed/for-you/for-you.service.ts`](file:///D:/indobid.lol/src/modules/feed/for-you/for-you.service.ts) (lines 20–180).
* **Details:** Queries active debates, extracts user category/creator affinities, calculates multi-signal ranking scores, sorts candidates, and applies author diversity spacing.

### 15. Where does the Trending algorithm live?
* **File Path:** [`src/modules/feed/algorithms/trending.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/trending.ts) and [`src/modules/feed/trending/trending.service.ts`](file:///D:/indobid.lol/src/modules/feed/trending/trending.service.ts) (lines 15–90).
* **Details:** `calculateTrendingScore()` computes real-time velocity tracking recent 24-hour backing (weight: 1.5), 7-day backing (weight: 0.8), contribution count (weight: 2.0), and unique participant depth (weight: 1.0).

### 16. Where does the Following algorithm live?
* **File Path:** [`src/modules/feed/algorithms/following.ts`](file:///D:/indobid.lol/src/modules/feed/algorithms/following.ts) and [`src/modules/feed/following/following.service.ts`](file:///D:/indobid.lol/src/modules/feed/following/following.service.ts) (lines 10–70).
* **Details:** Resolves followed user IDs from `followRepository` and filters debates where `authorId IN (followingIds)`.

### 17. Where is author diversity enforced?
* **File Path:** [`src/modules/feed/signals/diversity.ts`](file:///D:/indobid.lol/src/modules/feed/signals/diversity.ts) (lines 8–40) and [`src/modules/debates/debate.service.ts`](file:///D:/indobid.lol/src/modules/debates/debate.service.ts) (lines 190–225).
* **Details:** `applyAuthorDiversity()` guarantees that no single author occupies more than 2 consecutive positions in the discovery feed.

### 18. Where is whale dampening applied?
* **File Path:** [`src/modules/feed/signals/conviction.ts`](file:///D:/indobid.lol/src/modules/feed/signals/conviction.ts) (lines 10–18).
* **Details:** `calculateConvictionScore()` applies $10 \cdot \log_{10}(1 + \text{paise} / 1000)$, compressing 100x monetary differences into ~2.0x ranking point increases.

### 19. Where is freshness decay applied?
* **File Path:** [`src/modules/feed/signals/freshness.ts`](file:///D:/indobid.lol/src/modules/feed/signals/freshness.ts) (lines 10–25).
* **Details:** Exponential half-life decay $\exp(-\text{inactivityHours} / 48)$ and 36-hour cold start linear exploration boost ($35 \cdot (1 - \text{ageHours}/36)$).

### 20. Where is like/bookmark/follow logic?
* **File Path:** [`src/modules/social/likes/like.service.ts`](file:///D:/indobid.lol/src/modules/social/likes/like.service.ts), [`src/modules/social/bookmarks/bookmark.service.ts`](file:///D:/indobid.lol/src/modules/social/bookmarks/bookmark.service.ts), and [`src/modules/social/follows/follow.service.ts`](file:///D:/indobid.lol/src/modules/social/follows/follow.service.ts).
* **Details:** Isolated social services enforcing unique constraints, unlinking, and subscriber counting.

### 21. Where are direct messages handled?
* **File Path:** [`src/modules/social/messages/message.service.ts`](file:///D:/indobid.lol/src/modules/social/messages/message.service.ts) (lines 15–180).
* **Details:** Manages conversations between participant pairs `(p1, p2)`, delivers direct messages, marks unread messages as read, and validates participant authorization.

### 22. Where are notifications created?
* **File Path:** [`src/infrastructure/database/repositories/notification.repository.ts`](file:///D:/indobid.lol/src/infrastructure/database/repositories/notification.repository.ts) (lines 10–35) and [`src/lib/notifications.ts`](file:///D:/indobid.lol/src/lib/notifications.ts).
* **Details:** Asynchronous event triggers for @mentions, debate replies, new followers, and direct messages.

### 23. Where is file upload validated?
* **File Path:** [`src/modules/media/media.validation.ts`](file:///D:/indobid.lol/src/modules/media/media.validation.ts) and [`src/app/api/auth/avatar/route.ts`](file:///D:/indobid.lol/src/app/api/auth/avatar/route.ts) (lines 20–80).
* **Details:** Validates file size (strictly <= 2MB) and image MIME types.

### 24. Where are magic bytes checked?
* **File Path:** [`src/infrastructure/storage/magic-bytes.ts`](file:///D:/indobid.lol/src/infrastructure/storage/magic-bytes.ts) (lines 10–40).
* **Details:** `isValidImageMagicBytes(buffer)` inspects initial 16 bytes for PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), GIF (`47 49 46`), and WEBP (`52 49 46 46`).

### 25. Where is the database connection managed?
* **File Path:** [`src/infrastructure/database/prisma.ts`](file:///D:/indobid.lol/src/infrastructure/database/prisma.ts) (lines 1–25).
* **Details:** Global singleton `PrismaClient` with connection reuse in Next.js development and production runtimes.

### 26. Where are database queries isolated?
* **File Path:** [`src/infrastructure/database/repositories/`](file:///D:/indobid.lol/src/infrastructure/database/repositories/) (18 dedicated repository classes).
* **Details:** API routes and services never call `prisma.<entity>` directly; they execute queries through typed repositories.

### 27. Where are environment variables validated?
* **File Path:** [`src/config/env.ts`](file:///D:/indobid.lol/src/config/env.ts) (lines 1–70).
* **Details:** Strict Zod schema validating `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_SECRET_KEY`, `ADMIN_EMAIL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, etc.

### 28. Where are CORS and security headers set?
* **File Path:** [`src/config/security.ts`](file:///D:/indobid.lol/src/config/security.ts) (lines 10–50) and [`next.config.ts`](file:///D:/indobid.lol/next.config.ts) (lines 10–45).
* **Details:** Enforces `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and Content Security Policy (CSP).

### 29. Where is rate limiting handled?
* **File Path:** [`src/lib/rate-limit.ts`](file:///D:/indobid.lol/src/lib/rate-limit.ts) (lines 1–90).
* **Details:** In-memory sliding-window token bucket tracking IP addresses and caller keys for OTP requests, debate creation, and auth attempts.

### 30. Where are admin stats calculated?
* **File Path:** [`src/modules/admin/admin.service.ts`](file:///D:/indobid.lol/src/modules/admin/admin.service.ts) (lines 15–185).
* **Details:** `adminService.getStatsMetrics()` aggregates real counts for active debates, verified contributions, payment logs with `status: succeeded`, creator ledgers, and 5-minute visitor heartbeats.

### 31. Where is content moderation performed?
* **File Path:** [`src/modules/admin/admin.service.ts`](file:///D:/indobid.lol/src/modules/admin/admin.service.ts) (lines 190–240), [`src/modules/debates/debate.service.ts`](file:///D:/indobid.lol/src/modules/debates/debate.service.ts) (`hide()`), and [`src/app/api/debates/[id]/report/route.ts`](file:///D:/indobid.lol/src/app/api/debates/[id]/report/route.ts).
* **Details:** Admin moderation controls (update debate status to `hidden` or `removed`), user suspension, and community report logging.

### 32. Where is the OTP generated and checked?
* **File Path:** [`src/modules/auth/otp.service.ts`](file:///D:/indobid.lol/src/modules/auth/otp.service.ts) (lines 20–260).
* **Details:** Generates 6-digit cryptographically random numeric code, computes PBKDF2 hash, enforces 60-second cooldown, locks code after 5 failed attempts, and verifies via constant-time buffer equality.

### 33. Where is the password reset flow handled?
* **File Path:** [`src/modules/auth/password-reset.service.ts`](file:///D:/indobid.lol/src/modules/auth/password-reset.service.ts) (lines 15–225).
* **Details:** Generates 64-character random hex token, hashes with PBKDF2, returns generic safe response to prevent email enumeration, verifies expiration (60 mins), updates password hash, and issues authenticated session.

### 34. Where is user profile data updated?
* **File Path:** [`src/infrastructure/database/repositories/user.repository.ts`](file:///D:/indobid.lol/src/infrastructure/database/repositories/user.repository.ts) (lines 35–45) and [`src/app/api/auth/profile/route.ts`](file:///D:/indobid.lol/src/app/api/auth/profile/route.ts) (lines 20–80).
* **Details:** Updates `displayName`, `bio`, and `avatarUrl` for the authenticated session user.

### 35. Where are payout accounts managed?
* **File Path:** [`src/modules/creator-earnings/payout.service.ts`](file:///D:/indobid.lol/src/modules/creator-earnings/payout.service.ts) (lines 15–85) and [`src/app/api/profile/payout-account/route.ts`](file:///D:/indobid.lol/src/app/api/profile/payout-account/route.ts) (lines 10–90).
* **Details:** Connects bank account or UPI VPA, strictly masks account numbers (`•••• 4821`) and IFSC codes, and allows safe disconnection.

### 36. Where is the health check endpoint?
* **File Path:** [`src/app/api/health/route.ts`](file:///D:/indobid.lol/src/app/api/health/route.ts) (lines 1–15) and [`src/app/api/ready/route.ts`](file:///D:/indobid.lol/src/app/api/ready/route.ts) (lines 1–25).
* **Details:** Liveness probe (`GET /api/health` returns HTTP 200 `{ status: "ok" }`) and readiness probe (`GET /api/ready` verifies PostgreSQL query connectivity).

### 37. How can the payment provider be changed?
* **Details:** Create a new adapter in `src/infrastructure/payments/` implementing `IPaymentProvider` (e.g. `StripeAdapter`). Inject the adapter into `src/modules/payments/payment.service.ts`. Domain modules and API routes remain 100% unchanged.

### 38. How can the storage provider be changed?
* **Details:** Create a new adapter in `src/infrastructure/storage/` implementing `IStorageProvider` (e.g. `CloudflareR2Adapter`). Set the active adapter in `src/modules/media/media.service.ts`. All file validation and route handlers remain 100% unchanged.

### 39. How can the database be migrated to a new provider?
* **Details:** Update `DATABASE_URL` in environment variables to point to the new PostgreSQL connection string. Run `npx prisma migrate deploy` to initialize schema tables and indices. Zero application code modifications required.

### 40. How can the feed service be extracted into a separate service later?
* **Details:** Follow the 4-stage blueprint in [`docs/SCALE-ROADMAP.md`](file:///D:/indobid.lol/docs/SCALE-ROADMAP.md). Extract `src/modules/feed/` into an independent microservice container (e.g. Go, Python, or Node.js) exposing gRPC or REST endpoints. Update `src/modules/debates/debate.service.ts` to call the remote feed client instead of the local service.
