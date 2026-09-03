# indobid.lol — The Public Pay-To-Rank Attention Marketplace

> **"Pay more. Rank higher. Every position is earned with a verified bid."**

`indobid.lol` is a transparent, production-ready, pay-to-rank leaderboard and attention marketplace.

---

## ⚡ Core Product Rules

1. **RANK = VERIFIED BID**: There is no hidden quality score, voting score, popularity score, or algorithm. Position is strictly determined by verified cumulative bids (`ORDER BY verified_bid DESC, bid_reached_at ASC`).
2. **Incremental Bidding**: Users only pay the difference to raise an existing listing's rank.
3. **Strict Payment Security**: The frontend never determines or changes `verified_bid`. All amounts are computed server-side and updated exclusively via cryptographically signed Stripe webhooks with database transaction idempotency.
4. **First-Party Click Tracking**: Outbound destination visits are routed through `/visit/:listingId` with anti-abuse protection and marked `rel="sponsored"`.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + React 19 + TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database & ORM**: SQLite / PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Payments**: Stripe Checkout + Cryptographic Webhooks
- **Icons**: Lucide Icons + Custom Platform SVGs

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm or pnpm

### 2. Clone & Install
```bash
git clone <repo-url>
cd indobid.lol
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/indobid_db?schema=public"
RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL="vishalkumar75912@gmail.com"
ADMIN_SECRET_KEY="indobid_admin_secret_key_2026"
```

### 4. Database Setup & Seeding
```bash
npx prisma db push
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

The repository includes an end-to-end test suite validating all 26 core product test cases:

```bash
npm test
```

### Test Coverage (26 Cases)
1. New listing with minimum bid ($5.00).
2. New listing placed below #1.
3. New listing taking #1 rank globally.
4. Existing listing increases cumulative bid.
5. User pays only incremental difference.
6. Failed payment never affects leaderboard.
7. Canceled checkout preserves leaderboard state.
8. Duplicate webhook rejected idempotently without doubling bids.
9. 3x identical webhook deliveries handled cleanly.
10. Concurrent payments processed atomically in DB transactions.
11. Equal bids tie-broken deterministically by earlier `bid_reached_at`.
12. Duplicate URL submission deduplicated to canonical key.
13. UTM & tracking parameters stripped cleanly during canonicalization.
14. Malformed/invalid URLs, localhost, and script protocols rejected.
15. Platform detection (Website, X, YouTube, Instagram, other).
16. Admin can hide listings.
17. Hidden listings strictly excluded from public leaderboard.
18. First-party outbound click tracking (`/visit/:listingId`).
19. Responsive mobile layout.
20. Responsive desktop layout.
21. Category filtering.
22. Global and category rank calculation.
23. Checkout amount matches server calculation.
24. Client cannot manipulate final bid amount.
25. Client cannot mark payment as successful.
26. Unauthorized admin access blocked with 401.

---

## 💳 Stripe Webhook Setup

For local webhook testing with Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed webhook secret into `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## 🛡️ Admin Moderation Panel

- Navigate to `/admin`
- Enter your configured `ADMIN_SECRET_KEY`
- Features:
  - Hide / Restore suspicious or malicious listings
  - Change listing category
  - View real-time Cashfree payment logs & order IDs
  - Inspect bid histories

---

## 🚢 Production Deployment

### Option A: Vercel / Netlify
1. Connect your GitHub repository.
2. Set Environment Variables in dashboard (`DATABASE_URL`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENVIRONMENT`, `ADMIN_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`).
3. Deploy!

### Option B: Node.js / Docker
```bash
npm run build
npm run start
```
