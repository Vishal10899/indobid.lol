# INDOBID — FEATURE CATALOG & IMPLEMENTATION STATUS

---

## 1. Feature Map Summary

| Feature Category | Implementation Details | Status | Verified Tests |
| :--- | :--- | :---: | :---: |
| **Free Public Social Experience** | Free reading, posting, liking, commenting, bookmarking, following | **IMPLEMENTED** | Yes (100% Pass) |
| **3 Locked Feed Modes** | For You (Personalized), Trending (48h Half-Life), Following (Social Graph) | **IMPLEMENTED** | Yes (100% Pass) |
| **Multi-Signal Ranking** | 6 Macro-Pillars, Logarithmic Anti-Whale, Author Spacing ($\le 2$) | **IMPLEMENTED** | Yes (100% Pass) |
| **Monetary Foundation** | Integer Paise ($1\text{ USD} = 100\text{ paise}$, $2\text{ USD} = 200\text{ paise}$ floor) | **IMPLEMENTED** | Yes (100% Pass) |
| **50/50 Creator Economics** | 50% Creator / 50% Platform split on eligible external backing | **IMPLEMENTED** | Yes (100% Pass) |
| **0% Self-Support Rule** | Creator initial stake ($sequence = 1$) & self-continuations earn 0% | **IMPLEMENTED** | Yes (100% Pass) |
| **Double-Entry Ledger** | Immutable records in `creator_earnings_ledger` with idempotency | **IMPLEMENTED** | Yes (100% Pass) |
| **Payment Gateway** | Razorpay Order Creation, HMAC Webhook & Verification, ACID Tx | **IMPLEMENTED** | Yes (100% Pass) |
| **PBKDF2 Password Security** | 100,000 rounds PBKDF2-SHA512 + 32-byte salt | **IMPLEMENTED** | Yes (100% Pass) |
| **Session Security** | HMAC-SHA256 Signed HttpOnly cookies with live DB suspension revocation | **IMPLEMENTED** | Yes (100% Pass) |
| **Founder Identity Lock** | Server-authoritative lock to `ADMIN_EMAIL` (`vishalkumar75912@gmail.com`) | **IMPLEMENTED** | Yes (100% Pass) |
| **Direct Messaging** | 1-to-1 Real-time direct messaging threads | **IMPLEMENTED** | Yes (100% Pass) |
| **In-App Notifications** | Real-time social, financial, and system event alerts | **IMPLEMENTED** | Yes (100% Pass) |
| **Content Moderation** | Abuse reporting, author hiding, admin resolution console | **IMPLEMENTED** | Yes (100% Pass) |
| **Media & Avatars** | Binary magic-byte validation (JPEG, PNG, GIF, WebP) | **IMPLEMENTED** | Yes (100% Pass) |
| **Automated Payout Engine** | Direct bank/UPI automated disbursement | *PLANNED* | N/A (Manual Admin) |
