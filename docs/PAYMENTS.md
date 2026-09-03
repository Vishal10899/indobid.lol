# INDOBID — PAYMENTS & CREATOR ECONOMICS SPECIFICATION

---

## 1. Monetary Foundation & Arithmetic
* **Strict Integer Units**: All monetary amounts are integer **paise** ($1\text{ USD} = 100\text{ paise}$, $2\text{ USD} = 200\text{ paise}$).
* **Minimum Starting Floor**: $2.00 USD (200 paise) for paid post creation or challenge support ([`src/lib/money/index.ts`](file:///D:/indobid.lol/src/lib/money/index.ts)).
* **Continuation Increment**: Minimum +$1.00 USD (100 paise) step-up over the previous contribution.

---

## 2. The 50/50 Creator Revenue Split Engine
* **Split Ratio**: 50% to Creator (`CREATOR_SHARE_BPS = 5000`) / 50% to Platform Protocol.
* **Self-Support Immunity**: If contributor is the debate author (`isDebateAuthor === true`) or for origin stake (`sequence === 1`), creator reward is strictly **0 paise**.
* **Double-Entry Ledger**: Every verified community backer contribution creates an immutable record in `creator_earnings_ledger` with unique constraints on `[contributionId]` and `[idempotencyKey]`.
* **Location**: [`src/modules/creator-economics/earnings.service.ts`](file:///D:/indobid.lol/src/modules/creator-economics/earnings.service.ts)

---

## 3. Razorpay Integration & Webhook Idempotency
* **Provider Abstraction**: [`src/infrastructure/payments/payment.provider.interface.ts`](file:///D:/indobid.lol/src/infrastructure/payments/payment.provider.interface.ts)
* **Razorpay Adapter**: [`src/infrastructure/payments/razorpay/`](file:///D:/indobid.lol/src/infrastructure/payments/razorpay/)
* **Dual-Path Fulfillment**:
  - Path 1: Client signature verification (`POST /api/payments/verify`)
  - Path 2: Webhook signature verification (`POST /api/webhooks/razorpay`)
* **ACID Transactions**: Handled in `PaymentService.fulfillPayment()` inside `prisma.$transaction()`.
