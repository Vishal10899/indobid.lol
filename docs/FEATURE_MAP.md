# INDOBID — FEATURE OWNERSHIP & ARCHITECTURE MAP

**Document Version:** 2.0.0  
**Status:** Authoritative Feature Ownership Reference  

---

## 1. Feature Breakdown by Layer

### 1.1 LIKE FEATURE
* **Service:** `src/modules/social/likes/like.service.ts`
* **Repository:** `src/infrastructure/database/repositories/like.repository.ts`
* **API Route:** `src/app/api/debates/[id]/like/route.ts`
* **Database Model:** `DebateLike`
* **UI Components:** `src/components/debate/DebateCard.tsx`, `src/components/debate/LikeButton.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 3)
* **External Providers:** None (Free action)
* **Environment Variables:** None

### 1.2 BOOKMARK FEATURE
* **Service:** `src/modules/social/bookmarks/bookmark.service.ts`
* **Repository:** `src/infrastructure/database/repositories/bookmark.repository.ts`
* **API Route:** `src/app/api/debates/[id]/bookmark/route.ts`
* **Database Model:** `DebateBookmark`
* **UI Components:** `src/components/debate/DebateCard.tsx`, `src/components/debate/BookmarkButton.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 3)
* **External Providers:** None (Free action)
* **Environment Variables:** None

### 1.3 FOLLOW FEATURE
* **Service:** `src/modules/social/follows/follow.service.ts`
* **Repository:** `src/infrastructure/database/repositories/follow.repository.ts`
* **API Route:** `src/app/api/users/[username]/follow/route.ts`
* **Database Model:** `Follow`
* **UI Components:** `src/components/profile/FollowButton.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 3)
* **External Providers:** None (Free action)
* **Environment Variables:** None

### 1.4 DEBATE / OPINION CREATION (FREE & BACKED)
* **Service:** `src/modules/debates/debate.service.ts`
* **Repository:** `src/infrastructure/database/repositories/debate.repository.ts`
* **API Route:** `src/app/api/debates/route.ts`
* **Database Models:** `Debate`, `Contribution`, `Category`
* **UI Components:** `src/components/debate/CreateDebateModal.tsx`, `src/components/debate/NewDebateForm.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 1, 10, 13)
* **External Providers:** Razorpay (only when paid backing is selected)
* **Environment Variables:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

### 1.5 CONTINUATION / PERSPECTIVE BACKING
* **Service:** `src/modules/debates/debate.service.ts`, `src/modules/payments/payment.service.ts`
* **Repository:** `src/infrastructure/database/repositories/contribution.repository.ts`
* **API Route:** `src/app/api/debates/[id]/continue/route.ts`, `src/app/api/checkout/route.ts`
* **Database Models:** `Contribution`, `Payment`, `CreatorEarningsLedger`
* **UI Components:** `src/components/debate/ContinueModal.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 1, 2, 13)
* **External Providers:** Razorpay
* **Environment Variables:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

### 1.6 50/50 CREATOR REVENUE SPLIT & LEDGER
* **Service:** `src/modules/creator-earnings/earnings.service.ts`
* **Repository:** `src/infrastructure/database/repositories/ledger.repository.ts`
* **API Route:** `src/app/api/webhooks/razorpay/route.ts`
* **Database Model:** `CreatorEarningsLedger`
* **UI Components:** `src/components/profile/EarningsCard.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 4, 13)
* **External Providers:** Razorpay Webhook
* **Environment Variables:** `RAZORPAY_WEBHOOK_SECRET`

### 1.7 CREATOR PAYOUT ACCOUNTS
* **Service:** `src/modules/creator-earnings/payout.service.ts`
* **Repository:** `src/infrastructure/database/repositories/payout-account.repository.ts`
* **API Route:** `src/app/api/profile/payout-account/route.ts`
* **Database Model:** `PayoutAccount`
* **UI Components:** `src/components/profile/PayoutAccountModal.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 4)
* **External Providers:** None (Masked bank/UPI storage)
* **Environment Variables:** None

### 1.8 FOR YOU / TRENDING / FOLLOWING DISCOVERY FEEDS
* **Service:** `src/modules/feed/feed.service.ts`, `src/modules/feed/algorithms/`
* **Repository:** `src/infrastructure/database/repositories/debate.repository.ts`
* **API Route:** `src/app/api/debates/route.ts?mode=for_you|trending|following`
* **Database Models:** `Debate`, `Contribution`, `DebateLike`, `DebateBookmark`
* **UI Components:** `src/components/feed/FeedList.tsx`, `src/components/feed/FeedTabs.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 7, 10, 13)
* **External Providers:** None
* **Environment Variables:** None

### 1.9 AUTHENTICATION & EMAIL OTP
* **Service:** `src/modules/auth/auth.service.ts`, `src/modules/auth/otp.service.ts`
* **Repository:** `src/infrastructure/database/repositories/user.repository.ts`, `otp.repository.ts`
* **API Route:** `src/app/api/auth/signup/route.ts`, `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/resend-otp/route.ts`
* **Database Models:** `User`, `EmailOtp`
* **UI Components:** `src/components/auth/SignupModal.tsx`, `src/components/auth/OtpVerificationModal.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 6, 11)
* **External Providers:** Resend (Email gateway)
* **Environment Variables:** `RESEND_API_KEY`, `SESSION_SECRET`

### 1.10 PASSWORD RESET
* **Service:** `src/modules/auth/password-reset.service.ts`
* **Repository:** `src/infrastructure/database/repositories/password-reset.repository.ts`
* **API Route:** `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`
* **Database Models:** `User`, `PasswordResetToken`
* **UI Components:** `src/components/auth/ForgotPasswordModal.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 6)
* **External Providers:** Resend (Email gateway)
* **Environment Variables:** `RESEND_API_KEY`, `SESSION_SECRET`

### 1.11 DIRECT MESSAGING
* **Service:** `src/modules/social/messages/message.service.ts`
* **Repository:** `src/infrastructure/database/repositories/message.repository.ts`
* **API Route:** `src/app/api/messages/route.ts`, `src/app/api/messages/[conversationId]/route.ts`
* **Database Models:** `DirectMessage`, `Conversation`
* **UI Components:** `src/components/messages/MessageThread.tsx`, `src/components/messages/ConversationList.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 8)
* **External Providers:** None
* **Environment Variables:** None

### 1.12 ADMIN DASHBOARD & MODERATION
* **Service:** `src/modules/admin/admin.service.ts`
* **Repository:** `src/modules/admin/admin.repository.ts`, `src/infrastructure/database/repositories/report.repository.ts`
* **API Route:** `src/app/api/admin/stats/route.ts`, `src/app/api/admin/debates/route.ts`, `src/app/api/admin/users/route.ts`
* **Database Models:** `Debate`, `User`, `Payment`, `CreatorEarningsLedger`, `DebateReport`
* **UI Components:** `src/components/admin/AdminStatsGrid.tsx`, `src/components/admin/ModerationTable.tsx`
* **Tests:** `tests/run-all-tests.ts` (Parts 5, 12)
* **External Providers:** None
* **Environment Variables:** `ADMIN_SECRET_KEY`, `ADMIN_EMAIL`

### 1.13 MEDIA & AVATARS
* **Service:** `src/modules/media/media.service.ts`
* **Repository:** `src/infrastructure/database/repositories/user.repository.ts`
* **API Route:** `src/app/api/auth/avatar/route.ts`
* **Database Model:** `User` (`avatarUrl`)
* **UI Components:** `src/components/profile/AvatarUpload.tsx`
* **Tests:** `tests/run-all-tests.ts` (Part 9)
* **External Providers:** `IStorageProvider` (Database / Local / S3)
* **Environment Variables:** None (optional `S3_BUCKET_URL`)
