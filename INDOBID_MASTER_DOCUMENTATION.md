# INDO BID — MASTER PRODUCT, SYSTEM, ARCHITECTURE, SECURITY & BUSINESS LOGIC DOCUMENTATION

**Authoritative Technical Reference & Codebase Reverse-Engineering Document**  
**Version:** 1.0 (Production Master)  
**Date of Audit:** September 2, 2026  
**Audited Target:** IndoBid Core Platform (`D:\indobid.lol`)  
**Engine:** Next.js 16.3.3 (App Router, Turbopack) | TypeScript Strict | Prisma ORM | PostgreSQL

---

## TABLE OF CONTENTS

1. [PART 1 — First Understand the Product](#part-1--first-understand-the-product)
2. [PART 2 — Product Vision & Philosophy](#part-2--product-vision--philosophy)
3. [PART 3 — Complete User Types & Permission Matrix](#part-3--complete-user-types--permission-matrix)
4. [PART 4 — Complete User Journeys](#part-4--complete-user-journeys)
5. [PART 5 — Authentication System Architecture](#part-5--authentication-system-architecture)
6. [PART 6 — Email OTP Verification System](#part-6--email-otp-verification-system)
7. [PART 7 — Password Reset & Recovery Security](#part-7--password-reset--recovery-security)
8. [PART 8 — User Profile & Economic Reputation](#part-8--user-profile--economic-reputation)
9. [PART 9 — Social Media Layer & Engagement](#part-9--social-media-layer--engagement)
10. [PART 10 — Post & Opinion Ladder Mechanics](#part-10--post--opinion-ladder-mechanics)
11. [PART 11 — Post Creation Payment Architecture](#part-11--post-creation-payment-architecture)
12. [PART 12 — Backing & Continuation Escalation](#part-12--backing--continuation-escalation)
13. [PART 13 — Creator Economics Engine (50/50 Split)](#part-13--creator-economics-engine-5050-split)
14. [PART 14 — Creator Wallet & Payout System](#part-14--creator-wallet--payout-system)
15. [PART 15 — Anonymous Mode & Privacy Architecture](#part-15--anonymous-mode--privacy-architecture)
16. [PART 16 — Social Messaging (Direct Messages)](#part-16--social-messaging-direct-messages)
17. [PART 17 — Notifications Engine](#part-17--notifications-engine)
18. [PART 18 — Complete Database Architecture](#part-18--complete-database-architecture)
19. [PART 19 — Complete API Directory](#part-19--complete-api-directory)
20. [PART 20 — Frontend Architecture & App Router](#part-20--frontend-architecture--app-router)
21. [PART 21 — UI/UX Design System](#part-21--uiux-design-system)
22. [PART 22 — Dark, Light & System Appearance](#part-22--dark-light--system-appearance)
23. [PART 23 — Admin Operational Suite](#part-23--admin-operational-suite)
24. [PART 24 — Founder Identity & Privileges](#part-24--founder-identity--privileges)
25. [PART 25 — Analytics & Real-Time Visitor Heartbeat](#part-25--analytics--real-time-visitor-heartbeat)
26. [PART 26 — Moderation, Safety & Content Reporting](#part-26--moderation-safety--content-reporting)
27. [PART 27 — Complete Security Audit](#part-27--complete-security-audit)
28. [PART 28 — Payment Security & Integrity Audit](#part-28--payment-security--integrity-audit)
29. [PART 29 — Data Integrity & Financial Accounting](#part-29--data-integrity--financial-accounting)
30. [PART 30 — Current Production Database State](#part-30--current-production-database-state)
31. [PART 31 — Environment Variables Reference](#part-31--environment-variables-reference)
32. [PART 32 — External Integrations & Infrastructure](#part-32--external-integrations--infrastructure)
33. [PART 33 — Complete End-to-End Money Flow](#part-33--complete-end-to-end-money-flow)
34. [PART 34 — Complete System Event Flows](#part-34--complete-system-event-flows)
35. [PART 35 — Codebase Directory & File Map](#part-35--codebase-directory--file-map)
36. [PART 36 — "Where Does This Rule Live?" Guide](#part-36--where-does-this-rule-live-guide)
37. [PART 37 — Testing Suite & Verification Matrix](#part-37--testing-suite--verification-matrix)
38. [PART 38 — Build, Deployment & Local Setup](#part-38--build-deployment--local-setup)
39. [PART 39 — Error Handling & Failure Responses](#part-39--error-handling--failure-responses)
40. [PART 40 — Performance & Scalability Review](#part-40--performance--scalability-review)
41. [PART 41 — Mobile-First Architecture](#part-41--mobile-first-architecture)
42. [PART 42 — Product State & Completeness Review](#part-42--product-state--completeness-review)
43. [PART 43 — "Explain IndoBid in 5 Minutes" (Founder Pitch)](#part-43--explain-indobid-in-5-minutes-founder-pitch)
44. [PART 44 — "IndoBid for a New Engineer" (Onboarding)](#part-44--indobid-for-a-new-engineer-onboarding)
45. [PART 45 — "Do Not Break These Rules" (System Invariants)](#part-45--do-not-break-these-rules-system-invariants)
46. [PART 46 — Final Executive Summary](#part-46--final-executive-summary)
47. [Final System Health Report](#final-system-health-report)
48. [Open Issues / Risks](#open-issues--risks)
49. [Recommended Next Steps](#recommended-next-steps)

---

# PART 1 — FIRST UNDERSTAND THE PRODUCT

### 1.1 What Exactly Is IndoBid?
**IndoBid** is a social marketplace for human opinions, structured debates, and intellectual discussions where content visibility, rank, and debate priority are determined by **financial conviction** (skin in the game).

### 1.2 What Problem Does It Solve?
1. **The Asymmetry of Low-Effort Social Media**: On traditional networks (X/Twitter, Reddit, Instagram), posting an opinion or attacking someone’s viewpoint costs ₹0.00 and zero reputational friction. This leads to bot armies, rage bait, noise, and low-signal spam.
2. **Lack of True Signal**: Likes and retweets do not measure true conviction. A user will casually click "Like" on 100 contradictory posts in 5 minutes without believing in any of them.
3. **Misaligned Creator Incentives**: Social media creators are incentivized to produce divisive, incendiary content to farm free algorithmic impressions rather than defending well-reasoned theses.

### 1.3 Why Would a Normal Person Use It?
- **High-Signal Reading**: A user can browse and read high-conviction debates for **100% free**, knowing that every opinion on the platform has real capital staked behind it.
- **Fair Voice**: On IndoBid, an unknown debater with a sharp argument and ₹10 can challenge an established thought leader on equal footing.
- **Direct Monetization**: If a user writes an insightful opinion that attracts debate and community backing, they earn real money (50% of all external backing).

### 1.4 Why Would Someone Pay Money on IndoBid?
- **Publishing Priority**: To stake an official claim and take the debate podium (₹10 minimum floor).
- **Argument Escalation**: To directly challenge an opinion or provide a counter-thesis in a sequence chain (+₹1 step-up minimum).
- **Conviction Signaling**: To prove to the world: *"I believe in this perspective enough to put real money behind it."*

### 1.5 Why Would a Creator Publish an Opinion?
- To test their thesis against real capital.
- To build a reputation based on **total backed capital** rather than shallow follower counts.
- To generate creator earnings: every external backer or challenger sends **50% of their contribution** directly into the creator's wallet balance.

### 1.6 How IndoBid Compares to Other Platforms

```
┌─────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Platform Category       │ How IndoBid Differs                                                    │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Traditional Social (X)  │ No follower monopoly. Money + argument creates rank. Zero spam farms.  │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Discussion Forums       │ Upvotes are free; IndoBid rankings require real economic stakes.       │
│ (Reddit / Hacker News)  │                                                                        │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Visual Social (IG)      │ Focused entirely on text-based intellectual arguments, not aesthetics. │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Prediction Markets      │ Not binary gambling on future events; users back permanent arguments.  │
│ (Polymarket / Kalshi)   │                                                                        │
├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Crowdfunding            │ Micro-conviction backing ideas in real-time, not project fulfillment.  │
└─────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

### 1.7 Exact Platform Positioning
IndoBid is an **Editorial Social Marketplace for High-Conviction Opinions & Structured Discussions**. It is neither a betting platform nor a conventional social network; it is a financialized marketplace for discourse.

### 1.8 The Core Product Loop

```
1. Creator Stakes ₹10 & Posts Opinion
                 │
                 ▼
2. Platform Verifies Payment & Publishes to Global Feed
                 │
                 ▼
3. Readers Browse & Read for Free (100% Open Access)
                 │
                 ▼
4. Challenger / Backer Stakes ₹11+ to Respond or Support
                 │
                 ▼
5. Payment Verified Server-Side (50% Creator / 50% Platform)
                 │
                 ▼
6. Debate Momentum Increases ──► Rises to Top of Trending
                 │
                 ▼
7. More Readers Discover Debate ──► More Backers Participate ──► Creator Earns More
```

---

# PART 2 — PRODUCT VISION & PHILOSOPHY

### 2.1 Core Philosophical Thesis
> **"Don't measure an opinion by how many people like it. Measure it by how much people are willing to put behind it."**

### 2.2 Why Reading Remains Free
Reading is 100% free to maximize the **top-of-funnel audience**. By allowing anyone worldwide to read complete debate threads without a paywall, IndoBid builds massive distribution for its creators. Financial friction is applied exclusively at the **point of participation (writing and backing)**.

### 2.3 Why Anonymity Exists
Intellectual honesty often requires freedom from social retribution, corporate employer policies, or cancel culture. IndoBid allows debaters to publish under `@anonymous`.
- **Public Surface**: Displays `@anonymous`, masks profile links and avatar.
- **Internal Reality**: Attributed authoritatively to the creator's real account for legal safety, moderation audit trails, and private wallet earnings crediting.

### 2.4 Purpose Matrix for Social Features

```
┌───────────────┬──────────────────────────────────────────────────────────────────────────────────────────┐
│ Social Feature│ Purpose & System Value                                                                   │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Free Likes    │ Zero-friction social affirmation for visitors and signed-in users.                       │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Bookmarks     │ Private curation allowing debaters to track long-running arguments in their /saved view. │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Following     │ Curates a dedicated "Following" feed tab showing updates from preferred debaters.        │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Direct Msg    │ Private encrypted-feel 1-on-1 messaging for high-conviction debaters to network.         │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Impressions   │ Tracks unique reader sessions to calculate view velocity and debate engagement ratios.   │
└───────────────┴──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 3 — COMPLETE USER TYPES & PERMISSION MATRIX

### 3.1 Role Taxonomy in Source Code
The system defines 4 operational roles across database and middleware:
1. **Unauthenticated Visitor (`Guest`)**: Browses feeds, reads debates, registers.
2. **Authenticated User (`user`)**: Verified email account, can post, back, like, bookmark, message, and earn.
3. **Post Author (`Author`)**: Contextual role for the creator of a specific debate thread. Can edit and soft-hide their own posts.
4. **Founder (`founder`)**: Authoritative administrator and founder (`src/lib/founder.ts`) mapped to `@vishalchaudhary`. Possesses free post publishing privileges, full moderation authority, and platform administration rights.
5. **Administrator (`admin`)**: Possesses administrative dashboard access via signed admin session tokens.

### 3.2 Authoritative Permission Matrix

```
┌─────────────────────────────────┬─────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Capability                      │ Visitor │ Normal User  │ Post Author  │ Founder      │ Admin        │
├─────────────────────────────────┼─────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Browse & Read Public Feeds      │ YES     │ YES          │ YES          │ YES          │ YES          │
│ Search Opinions & Users         │ YES     │ YES          │ YES          │ YES          │ YES          │
│ Create Account & Verify OTP     │ YES     │ N/A          │ N/A          │ N/A          │ N/A          │
│ Create Paid Opinion (₹10 Floor) │ NO      │ YES          │ YES          │ FREE (₹0)    │ FREE (₹0)    │
│ Back / Continue Debate (₹11+)   │ NO      │ YES          │ YES          │ YES          │ YES          │
│ Free Like Opinion               │ YES*    │ YES          │ YES          │ YES          │ YES          │
│ Save / Bookmark Opinion         │ NO      │ YES          │ YES          │ YES          │ YES          │
│ Follow Debater                  │ NO      │ YES          │ YES          │ YES          │ YES          │
│ Send / Read Direct Messages     │ NO      │ YES          │ YES          │ YES          │ YES          │
│ Edit Post Content / Hashtags    │ NO      │ NO           │ YES (Own)    │ YES (Any)    │ YES (Any)    │
│ Soft-Hide Post (status=hidden)  │ NO      │ NO           │ YES (Own)    │ YES (Any)    │ YES (Any)    │
│ Hard Delete Post (DB purge)     │ NO      │ NO           │ NO           │ YES (Script) │ YES (Admin)  │
│ Post Under @anonymous           │ NO      │ YES          │ YES          │ YES          │ YES          │
│ View Creator Earnings Balance   │ NO      │ YES (Own)    │ YES (Own)    │ YES          │ YES (All)    │
│ Set Up Masked Payout Account    │ NO      │ YES          │ YES          │ YES          │ YES          │
│ Access Admin Operations (/admin)│ NO      │ NO           │ NO           │ YES          │ YES          │
│ Ingest Gateway Webhooks         │ GATEWAY │ NO           │ NO           │ NO           │ NO           │
└─────────────────────────────────┴─────────┴──────────────┴──────────────┴──────────────┴──────────────┘
* Note: Unauthenticated visitors can trigger free likes mapped to their IP hash.
```

---

# PART 4 — COMPLETE USER JOURNEYS

### 4.1 Journey A: Unauthenticated Visitor
1. **Entry**: Lands on `/` via desktop or mobile.
2. **Observation**: Views the 5 feed tabs (For You, Highest Value, Trending, New, Following). Reads debate titles, author reputation badges, conviction tags (`₹XX backed`), and arguments.
3. **Interaction Gate**: Clicks **"Start Conversation · ₹10"** or **"Sign In / Join"** $\rightarrow$ Triggers `AuthModal.tsx`.

### 4.2 Journey B: New User Registration & Verification

```
User enters username, display name, email, password
                     │
                     ▼
POST /api/auth/signup ──► User created (isVerified=false)
                     │
                     ▼
OTP Engine generates 6-digit cryptographic code
                     │
                     ▼
Code hashed with PBKDF2 & stored in email_otps table
                     │
                     ▼
Resend API sends email from IndoBid <noreply@indobid.lol>
                     │
                     ▼
User inputs 6 digits in AuthModal.tsx
                     │
                     ▼
POST /api/auth/verify-email ──► Validates hash & attempts
                     │
                     ▼
User marked isVerified=true & emailVerifiedAt=NOW()
                     │
                     ▼
Session cookie indobid_session issued (30-day rolling)
```

---

# PART 5 — AUTHENTICATION SYSTEM ARCHITECTURE

```
                                  ┌──────────────────────────┐
                                  │   Incoming HTTP Request  │
                                  └─────────────┬────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │ Reads 'indobid_session' Cookie Flag  │
                             └──────────────────┬───────────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │    HMAC-SHA256 Signature Verify      │
                             │ (Checked against server AUTH_SECRET) │
                             └──────────────────┬───────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
             [ Signature Valid ]                               [ Signature Invalid ]
                       │                                                 │
                       ▼                                                 ▼
            Decode Payload Claims                                Clear Cookie Header
       { userId, username, role, exp }                                    │
                       │                                                 ▼
                       ▼                                         Reject Request /
             Check Expiry vs NOW()                                Treat as Guest
```

### 5.1 Cryptographic Password Hashing (`src/lib/user-auth.ts`)
- **Function**: `hashPassword(password: string): Promise<string>`
- **Mechanism**: PBKDF2 with HMAC-SHA512.
- **Iterations**: 100,000 rounds.
- **Salt**: 16 cryptographically random bytes generated via `crypto.randomBytes(16)`.
- **Database Storage**: Formatted string `salt:hash` stored in `users.password_hash`.
- **Verification**: `verifyPassword(password, storedHash)` splits the salt, recalculates PBKDF2 with 100,000 rounds, and performs a timing-safe buffer comparison (`crypto.timingSafeEqual`).

### 5.2 Session Cookie Specifications
- **Cookie Name**: `indobid_session`
- **Security Flags**:
  - `httpOnly: true` (Inaccessible to browser JavaScript / XSS proof)
  - `sameSite: 'lax'` (CSRF defense)
  - `secure: process.env.NODE_ENV === 'production'` (Transmitted strictly over HTTPS)
  - `path: '/'`
  - `maxAge: 30 * 24 * 60 * 60` (30 days in seconds)

---

# PART 6 — EMAIL OTP VERIFICATION SYSTEM

### 6.1 Technical Specification (`src/lib/email-otp.ts`)

```
┌─────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Parameter               │ Technical Enforcement                                       │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ OTP Code Format         │ Strictly 6 numeric digits [100000..999999]                   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Randomness Engine       │ crypto.randomInt(100000, 1000000) (CSPRNG)                  │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Storage State           │ Plaintext NEVER stored. Stored as PBKDF2 SHA-256 codeHash.  │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Lifetime / Expiry       │ 10 minutes (600,000 ms) from issuance.                      │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Max Failed Attempts     │ 5 attempts. Exceeding locks the record permanently.         │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Resend Cooldown         │ 60 seconds strict rate limit enforced server-side.          │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Delivery Provider       │ Resend SDK (RESEND_API_KEY) via noreply@indobid.lol         │
└─────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

# PART 7 — PASSWORD RESET & RECOVERY SECURITY

### 7.1 Security Architecture (`src/lib/password-reset.ts`)
1. **User Request**: User inputs email into `AuthModal.tsx` (Forgot Password view) $\rightarrow$ calls `POST /api/auth/forgot-password`.
2. **Account Enumeration Defense**: The API returns `{ success: true, message: "If that email is registered, a reset link has been sent." }` regardless of whether the email exists in the database.
3. **Token Cryptography**:
   - Generates 32 cryptographically random bytes $\rightarrow$ converted to a 64-character hexadecimal token.
   - Computes `tokenHash = crypto.pbkdf2Sync(rawToken, salt, 10000, 32, 'sha256')`.
   - Stores `tokenHash`, `salt`, and `expiresAt` (60 minutes) in `password_reset_tokens` table.
4. **Token Verification**: Dedicated endpoint `POST /api/auth/reset-password/verify-token` verifies token validity before rendering the reset form.
5. **Execution**: `POST /api/auth/reset-password` updates password hash, marks `used: true`, and immediately invalidates all previous reset tokens for that email.

---

# PART 8 — USER PROFILE & ECONOMIC REPUTATION

### 8.1 Data Model & Visibility Segregation

```
┌──────────────────────────────────────┬───────────────────┬────────────────────────────┐
│ Attribute                            │ Public Profile    │ Private to Account Owner   │
├──────────────────────────────────────┼───────────────────┼────────────────────────────┤
│ Username & Display Name              │ VISIBLE           │ VISIBLE                    │
│ Profile Photo / Avatar               │ VISIBLE           │ VISIBLE                    │
│ Bio & Interests                      │ VISIBLE           │ VISIBLE                    │
│ Verification Shield & Founder Badge  │ VISIBLE           │ VISIBLE                    │
│ Follower / Following Counts          │ VISIBLE           │ VISIBLE                    │
│ Total Opinion Value Generated        │ VISIBLE           │ VISIBLE                    │
│ Total Capital Backed Across Debates  │ VISIBLE           │ VISIBLE                    │
│ Available / Pending Earnings Balance │ HIDDEN (Redacted) │ VISIBLE                    │
│ Payout Account (Masked Bank / UPI)   │ HIDDEN (Redacted) │ VISIBLE (Masked Only)      │
│ Raw Email Address                    │ HIDDEN (Redacted) │ VISIBLE                    │
└──────────────────────────────────────┴───────────────────┴────────────────────────────┘
```

---

# PART 9 — SOCIAL MEDIA LAYER & ENGAGEMENT

```
                                  ┌────────────────────────┐
                                  │   IndoBid Feed Engine  │
                                  └───────────┬────────────┘
                                              │
         ┌──────────────────┬─────────────────┼──────────────────┬─────────────────┐
         ▼                  ▼                 ▼                  ▼                 ▼
   [ For You ]      [ Highest Value ]   [ Trending ]          [ New ]        [ Following ]
   Formula-Ranked   Ranked strictly by  Velocity & Score   Reverse Chrono    Subscribed
   Discovery Feed   Total ₹ Backed      (trending.ts)      (createdAt DESC)  Debaters Only
```

### 9.1 Feed Ranking Logic (`src/lib/debates.ts`)
- **For You**: `ORDER BY trending_score DESC, total_verified_contribution DESC, created_at DESC`
- **Highest Value**: `ORDER BY total_verified_contribution DESC, created_at DESC`
- **Trending**: `ORDER BY trending_score DESC, last_contribution_at DESC`
- **New**: `ORDER BY created_at DESC`
- **Following**: Filtered to `author_id IN (user.followingIds)`, `ORDER BY created_at DESC`

### 9.2 Trending Formula (`src/lib/trending.ts`)
$$\text{Score} = \frac{\log_{10}(\text{Paise} + 1) \times 10000 + (\text{Contributions} \times 500) + (\text{Likes} \times 50)}{(\text{AgeInHours} + 2)^{1.5}}$$

---

# PART 10 — POST & OPINION LADDER MECHANICS

### 10.1 Post Object Definition
A Post (Debate) represents an official, published stance on an intellectual topic.
- `title`: Topic headline (5 to 200 characters).
- `content`: Primary viewpoint argument (10 to 3,000 characters).
- `originalContribution`: Creator’s initial floor stake (₹10.00 / 1000 paise).
- `totalVerifiedContribution`: Running sum of all verified sequence payments.
- `contributionCount`: Total count of paid interventions.
- `lastContributionAmount`: Amount staked by the most recent participant.

### 10.2 Post Lifecycle State Machine

```
   [ User Fills Composer ]
              │
              ▼
   ( POST /api/debates )
              │
              ▼
  ┌─────────────────────────┐
  │  status: pending_payment│
  │  amount: 1000 paise     │
  └───────────┬─────────────┘
              │
              ▼
    [ Razorpay Checkout ]
              │
      ┌───────┴────────┐
      ▼                ▼
[ Succeeded ]     [ Cancelled / Failed ]
      │                │
      ▼                ▼
( /api/payments/verify ) ( DB record remains pending_payment )
      │
      ▼
┌─────────────────────────┐
│ status: active          │ ◄── Published to public discovery feeds
└───────────┬─────────────┘
            │
            ├──────────────────────────┐
            ▼                          ▼
     [ Author Hides ]           [ Author Edits ]
            │                          │
            ▼                          ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ status: hidden          │   │ status: active          │
│ (Removed from feeds,    │   │ (content updated,       │
│  links preserved)       │   │  isEdited badge added)  │
└─────────────────────────┘   └─────────────────────────┘
```

---

# PART 11 — POST CREATION PAYMENT SYSTEM

```
                                  ┌───────────────────────────┐
                                  │ Creator Submits ₹10 Post  │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │       POST /api/debates          │
                               │ Validates: title>=5, content>=10 │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Razorpay API: orders.create()    │
                               │ Creates Order for 1000 paise     │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Creates 'pending_payment' Debate │
                               │ & 'pending_payment' Contribution │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Client Opens Razorpay Modal      │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Payment Success Callback         │
                               │ Sends orderId, paymentId, sig    │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ POST /api/payments/verify        │
                               │ HMAC SHA-256 Server Validation   │
                               └────────────────┬─────────────────┘
                                                │
                                                ▼
                               ┌──────────────────────────────────┐
                               │ Atomic Database Update:          │
                               │ 1. Debate.status = 'active'      │
                               │ 2. Contribution.status='verified'│
                               │ 3. Payment.status = 'succeeded'  │
                               │ 4. Total Verified = 1000 paise   │
                               └──────────────────────────────────┘
```

---

# PART 12 — BACKING & CONTINUATION ESCALATION

### 12.1 The +₹1 Step-Up Invariant (`src/lib/money.ts`)
Any user wishing to challenge, reply to, or back an existing debate must place a stake strictly greater than or equal to:
$$\text{Minimum Next Contribution} = \text{lastContributionAmount} + 100\text{ paise (₹1.00)}$$

### 12.2 Escalation Walkthrough

```
┌──────────┬──────────────┬──────────────┬─────────────┬───────────────────────────────────────────┐
│ Sequence │ Participant  │ Amount Paid  │ Min Next    │ System Action                             │
├──────────┼──────────────┼──────────────┼─────────────┼───────────────────────────────────────────┤
│ Seq #1   │ Creator (A)  │ ₹10.00       │ ₹11.00      │ Debate initialized with ₹10 floor.        │
│ Seq #2   │ Backer (B)   │ ₹11.00       │ ₹12.00      │ ₹5.50 earned by Creator A, ₹5.50 to IndoBid.│
│ Seq #3   │ Challenger(C)│ ₹25.00       │ ₹26.00      │ ₹12.50 earned by Creator A, ₹12.50 to IndoBid.│
│ Seq #4   │ Supporter(D) │ ₹50.00       │ ₹51.00      │ ₹25.00 earned by Creator A, ₹25.00 to IndoBid.│
└──────────┴──────────────┴──────────────┴─────────────┴───────────────────────────────────────────┘
```

---

# PART 13 — CREATOR ECONOMICS ENGINE (50/50 SPLIT)

### 13.1 Exact Formulas (`src/lib/creator-economics.ts`)
The platform allocates revenue based on `CREATOR_SHARE_BPS = 5000` (50.00%):

$$\text{creatorRewardPaise} = \left\lfloor \frac{\text{grossAmountPaise} \times 5000}{10000} \right\rfloor$$
$$\text{platformFeePaise} = \text{grossAmountPaise} - \text{creatorRewardPaise}$$

### 13.2 Self-Contribution Isolation Rule
- **Sequence #1 (Origin)**: Creator self-stake $\rightarrow$ **₹0.00 Creator Reward** (No self-reward).
- **Creator Rebuttals (Own responses)**: Creator self-responses $\rightarrow$ **₹0.00 Creator Reward**.
- **External 3rd-Party Responses**: Backer/Challenger responses $\rightarrow$ **Exact 50.00% Creator Reward**.

---

# PART 14 — CREATOR WALLET & PAYOUT SYSTEM

### 14.1 Payout Account Structure (`payout_accounts` table)
- **Account Type**: `'bank_account'` or `'upi'`.
- **Masking Standard**:
  - Bank Account: `•••• 4821` (Only last 4 digits stored; raw account numbers rejected).
  - IFSC: `HDFC•••••`
  - UPI ID: `vi••••@okhdfcbank`
- **Withdrawal Processing**: **User-triggered, manual administrative review**. *There is no unsupervised auto-debit banking transfer.*

---

# PART 15 — ANONYMOUS MODE & PRIVACY ARCHITECTURE

```
┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Context                              │ Identity Behavior                                      │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Public Web UI & Feeds                │ Displays @anonymous, default anonymous avatar,         │
│                                      │ no clickable link to profile.                          │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Internal Database Relations          │ author_id maps to the real User record.                 │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Financial Ledger Attribution         │ Creator rewards are credited to author_id's wallet.    │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Legal & Safety Compliance            │ Admins can trace abusive content to real accounts.      │
└──────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

# PART 16 — SOCIAL MESSAGING (DIRECT MESSAGES)

### 16.1 Direct Message Security
- **Unique Conversation Constraint**: `@@unique([participant1Id, participant2Id])` in `conversations` table.
- **Authorization Enforcement**: `GET /api/messages/[conversationId]` checks:
  ```typescript
  if (conversation.participant1Id !== user.id && conversation.participant2Id !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  ```

---

# PART 17 — NOTIFICATIONS ENGINE

### 17.1 Event Trigger Catalog
1. **`like`**: Triggered when a user likes your debate.
2. **`continuation`**: Triggered when a debater places a paid response on your debate.
3. **`mention`**: Triggered when an author includes `@yourusername` in a debate or reply.
4. **`follow`**: Triggered when a user follows your profile.
5. **`payment`**: Triggered when creator earnings are settled in your ledger.

---

# PART 18 — COMPLETE DATABASE ARCHITECTURE

```
                                  ┌─────────────────────────┐
                                  │          users          │
                                  └────────────┬────────────┘
                                               │
             ┌──────────────────┬──────────────┼──────────────┬──────────────────┐
             │ 1:N              │ 1:N          │ 1:1          │ 1:N              │ 1:N
             ▼                  ▼              ▼              ▼                  ▼
      ┌──────────────┐   ┌──────────────┐ ┌──────────┐ ┌──────────────┐   ┌──────────────┐
      │   debates    │   │contributions │ │  payout  │ │notifications │   │direct_messages│
      └──────┬───────┘   └──────┬───────┘ └──────────┘ └──────────────┘   └──────────────┘
             │ 1:N              │ 1:N
             ▼                  ▼
      ┌──────────────┐   ┌──────────────┐
      │   payments   │   │debate_reports│
      └──────┬───────┘   └──────────────┘
             │ 1:1
             ▼
┌───────────────────────────┐
│  creator_earnings_ledger  │
└───────────────────────────┘
```

---

# PART 19 — COMPLETE API DIRECTORY

```
┌────────┬─────────────────────────────────────┬─────────────────────────────────┬──────────────┐
│ Method │ Endpoint Path                       │ Purpose                         │ Auth Level   │
├────────┼─────────────────────────────────────┼─────────────────────────────────┼──────────────┤
│ GET    │ /api/debates                        │ Paginated discovery feed        │ Public       │
│ POST   │ /api/debates                        │ Create new debate thread        │ User / Guest │
│ GET    │ /api/debates/[id]                   │ Retrieve debate & reply chain   │ Public       │
│ PATCH  │ /api/debates/[id]                   │ Edit debate content/hashtags    │ Author Only  │
│ DELETE │ /api/debates/[id]                   │ Soft-hide debate from feeds     │ Author/Admin │
│ POST   │ /api/debates/[id]/continue          │ Initiate paid continuation bid  │ User / Guest │
│ POST   │ /api/debates/[id]/like              │ Toggle free like                │ Public       │
│ POST   │ /api/debates/[id]/bookmark          │ Toggle saved bookmark           │ User Only    │
│ POST   │ /api/debates/[id]/impression        │ Record unique read session      │ Public       │
│ POST   │ /api/debates/[id]/report            │ File moderation safety report   │ Public       │
│ POST   │ /api/payments/verify                │ Verify Razorpay signature       │ Public       │
│ POST   │ /api/webhooks/razorpay              │ Ingest gateway webhook event    │ Gateway Sig  │
│ POST   │ /api/auth/signup                    │ Create unverified user account  │ Public       │
│ POST   │ /api/auth/verify-email              │ Verify 6-digit email OTP        │ Public       │
│ POST   │ /api/auth/resend-otp                │ Request new verification OTP    │ Public       │
│ POST   │ /api/auth/login                     │ Authenticate user session       │ Public       │
│ POST   │ /api/auth/logout                    │ Clear session cookie            │ Public       │
│ GET    │ /api/auth/me                        │ Fetch active session profile    │ Public       │
│ POST   │ /api/auth/forgot-password           │ Send password reset email       │ Public       │
│ POST   │ /api/auth/reset-password            │ Finalize password reset token   │ Public       │
│ POST   │ /api/auth/reset-password/verify     │ Verify reset token validity     │ Public       │
│ GET    │ /api/profile/[username]             │ Fetch public profile & stats    │ Public       │
│ POST   │ /api/profile/payout-account         │ Save masked bank/UPI details    │ User Only    │
│ GET    │ /api/messages                       │ Fetch DM conversation list      │ User Only    │
│ POST   │ /api/messages                       │ Send direct message             │ User Only    │
│ GET    │ /api/messages/[conversationId]      │ Fetch conversation thread       │ Participant  │
│ GET    │ /api/notifications                  │ Fetch notifications feed        │ User Only    │
│ PATCH  │ /api/notifications                  │ Mark notifications as read      │ User Only    │
│ GET    │ /api/saved                          │ Fetch user's saved bookmarks    │ User Only    │
│ GET    │ /api/trending                       │ Fetch trending leaderboard      │ Public       │
│ GET    │ /api/activity                       │ Real-time conviction stream     │ Public       │
│ POST   │ /api/analytics/heartbeat            │ Record live visitor session     │ Public       │
│ GET    │ /api/admin/stats                    │ Overview analytics & metrics    │ Admin Only   │
│ GET    │ /api/admin/creator-economy          │ Creator ledgers audit           │ Admin Only   │
│ GET    │ /api/admin/debates                  │ Manage all debate threads       │ Admin Only   │
│ GET    │ /api/admin/users                    │ Manage platform user accounts   │ Admin Only   │
│ GET    │ /api/admin/reports                  │ Review flagged content reports  │ Admin Only   │
│ POST   │ /api/admin/login                    │ Authenticate admin console      │ Public       │
│ POST   │ /api/admin/logout                   │ Terminate admin session         │ Admin Only   │
└────────┴─────────────────────────────────────┴─────────────────────────────────┴──────────────┘
```

---

# PART 20 — FRONTEND ARCHITECTURE & APP ROUTER

```
┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ App Router Route             │ Component Tree & Responsibility                                        │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /                            │ Homepage (Sidebar + 5 Feed Tabs + RightSidebar + CreateDebateModal)    │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /explore                     │ Multi-category discovery, keyword search, and topic chips.             │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /trending                    │ Ranked financial conviction leaderboard (trending score formula).      │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /activity                    │ Live conviction stream showing real-time paid interventions.           │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /saved                       │ Private bookmark collection for signed-in debater.                     │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /messages                    │ Direct messaging center (conversation list & new message composer).    │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /messages/[conversationId]   │ 1-on-1 private chat thread with message history and real-time input.   │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /notifications               │ Activity inbox (likes, follows, continuations, mentions).              │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /profile/[username]          │ Profile view, economic metrics, tabs, and Settings / Appearance modal. │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /debate/[id]                 │ Debate detail view (DebateDetailClient, financial metrics, chain).     │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /reset-password              │ Standalone token verification and password reset interface.            │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /admin                       │ Administrative operations dashboard (analytics, moderation, ledgers).  │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ /_not-found                  │ Custom branded 404 error page.                                         │
└──────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

# PART 21 — UI/UX DESIGN SYSTEM

### 21.1 Color Palette System (`src/app/globals.css`)
- **Dark Editorial Surface**: Deep slate neutral (`--bg-page: #091114`, `--bg-surface: #0F1A1E`, `--bg-card: #121E23`).
- **Warm Editorial Light Surface**: Soft warm neutral (`--bg-page: #F5F0E8`, `--bg-surface: #FAF6EF`, `--bg-elevated: #FFFFFF`).
- **Warm Coral Accent**: Primary CTA & Brand identity (`--color-coral: #D98A6C`).
- **Amber Gold**: Financial conviction tag (`--color-amber: #D8B257`).
- **Lime Green**: System verification & trust (`--color-lime: #88B04B`).

---

# PART 22 — DARK, LIGHT & SYSTEM APPEARANCE

### 22.1 Zero-Flash Theme Bootstrapping (`src/app/layout.tsx`)
To prevent flash-of-unstyled-theme (FOUC), an inline script executes in `<head>` before DOM render:
```javascript
(function() {
  try {
    var saved = localStorage.getItem('indobid_theme');
    var isDark = true;
    if (saved === 'light') isDark = false;
    else if (saved === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
```

---

# PART 23 — ADMIN OPERATIONAL SUITE

### 23.1 Console Modules (`/admin`)
1. **Analytics**: Total registered users, total debates, gross transaction volume, live 5-minute visitor heartbeat.
2. **Debate Management**: Search, filter by status, inspect author, and soft-hide/freeze debates.
3. **Creator Economy Ledger**: Inspection of all pending, available, and reversed ledger entries.
4. **Moderation Queue**: Triage reports filed against debates and contributions.
5. **Founder Publishing Studio**: Direct publishing tool allowing the founder to post official debates at ₹0 cost.

---

# PART 24 — FOUNDER IDENTITY & PRIVILEGES

### 24.1 Authoritative Founder Architecture (`src/lib/founder.ts`)
- **Authoritative Identity**:
  - `role === 'founder'`
  - `username === 'vishalchaudhary'`
  - `email === 'vishalchaudhary74096@gmail.com'`
- **Privileges**:
  - Posts published via founder session bypass payment gateways with `originalContribution: 0` and `status: 'active'`.
  - External community members can back founder posts, generating standard 50% creator rewards for the Founder.
  - Possesses global moderation and editing authority.

---

# PART 25 — ANALYTICS & REAL-TIME VISITOR HEARTBEAT

### 25.1 Real-Time Visitor Heartbeat (`src/components/VisitorTracker.tsx`)
- **Session Identification**: Unique cookie token `indobid_visitor`.
- **Heartbeat Engine**: Triggers `POST /api/analytics/heartbeat` every 60 seconds.
- **Active Metric**: Query `visitor_sessions WHERE last_heartbeat_at >= NOW() - INTERVAL '5 minutes'`.

---

# PART 26 — MODERATION, SAFETY & CONTENT REPORTING

### 26.1 Reporting Architecture (`debate_reports` table)
- **Filing**: Any user or visitor can file a report with `reason` against a debate or contribution.
- **Action**: Soft-hiding transitions `status: 'hidden'`, immediately removing the item from all feeds while preserving database audit records.

---

# PART 27 — COMPLETE SECURITY AUDIT

```
┌─────────────────────────┬─────────────────────────────────────────────────────────────┬────────┐
│ Security Domain         │ Implementation Architecture                                 │ Status │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Password Storage        │ PBKDF2 HMAC-SHA512 with 100,000 rounds + 16-byte salt.      │ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Session Cookies         │ HttpOnly, SameSite=Lax, Secure HMAC-SHA256 tokens.          │ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ OTP Security            │ 10-min expiry, 5-attempt lockout, 60s cooldown, SHA-256 hash│ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Password Reset          │ 60-min expiry, single-use invalidation, enumeration defense.│ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Payment Verification    │ Server-side HMAC-SHA256 signature verification.             │ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Privilege Authorization │ Server session role validation (zero client trust).         │ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ SQL Injection Defense   │ Prisma ORM parameterized queries across all database calls. │ GOOD   │
├─────────────────────────┼─────────────────────────────────────────────────────────────┼────────┤
│ Financial Precision     │ Integer paise arithmetic (zero floating-point math).        │ GOOD   │
└─────────────────────────┴─────────────────────────────────────────────────────────────┴────────┘
```

---

# PART 28 — PAYMENT SECURITY & INTEGRITY AUDIT

1. **Client Payload Tampering Blocked**: Amounts in `verify` are matched against authoritative order records in the database.
2. **Webhook Signature Validation**: `x-razorpay-signature` validated using `crypto.createHmac('sha256', secret)`.
3. **Idempotency Guarantee**: `creator_earnings_ledger` enforces `@@unique([contribution_id])`, preventing duplicate reward generation on webhook replay.

---

# PART 29 — DATA INTEGRITY & FINANCIAL ACCOUNTING

- **No Negative Balances**: Decrement operations check available balance constraints before execution.
- **Double Counting Prevented**: Total verified contribution is computed via sequence aggregation.
- **Soft Deletes**: Deleting a post never orphans transaction records in `payments` or `creator_earnings_ledger`.

---

# PART 30 — CURRENT PRODUCTION DATABASE STATE

```
=== DATABASE AUDIT REPORT (September 2, 2026) ===

Total Users (1):
 - [founder] @vishalchaudhary (Vishal Chaudhary) | Email: vishalchaudhary74096@gmail.com | Verified: true

Total Debates (1):
 - [active] "We’re live." by @vishalchaudhary | ₹0 orig / ₹0 verified

Total Payments (1):
 - [succeeded] ₹2 | pay_TVwHuIxdxAm0MV | Provider: razorpay

Total Demo/Test Records: 0 (All test OTPs, ledgers, and temp users purged)
Total Active Visitor Sessions: 49
```

---

# PART 31 — ENVIRONMENT VARIABLES REFERENCE

```
┌──────────────────────┬──────────────────────────────────────────┬──────────┬─────────────┐
│ Variable Name        │ Purpose                                  │ Required │ Scope       │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ DATABASE_URL         │ PostgreSQL connection string             │ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ AUTH_SECRET          │ HMAC signing secret for session tokens   │ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ RESEND_API_KEY       │ Resend API key for OTP and reset emails  │ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ EMAIL_FROM           │ Sender name & address (IndoBid <...>)    │ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ RAZORPAY_KEY_ID      │ Razorpay public API key                  │ YES      │ Client/Serv │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ RAZORPAY_KEY_SECRET  │ Razorpay cryptographic webhook/sig secret│ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ ADMIN_SECRET_KEY     │ Emergency admin console passphrase       │ YES      │ Server Only │
├──────────────────────┼──────────────────────────────────────────┼──────────┼─────────────┤
│ NEXT_PUBLIC_BASE_URL │ Canonical domain URL (https://indobid.lol)│ YES      │ Client/Serv │
└──────────────────────┴──────────────────────────────────────────┴──────────┴─────────────┘
```

---

# PART 32 — EXTERNAL INTEGRATIONS & INFRASTRUCTURE

1. **PostgreSQL**: Primary transactional datastore for all models.
2. **Prisma ORM**: Type-safe query engine and migration framework.
3. **Razorpay**: Primary Indian payment gateway (UPI, Cards, NetBanking).
4. **Resend**: Transactional email delivery service for verification OTPs and reset tokens.

---

# PART 33 — COMPLETE END-TO-END MONEY FLOW

```
Example: Debater posts opinion (₹10), User B challenges (₹11), User C backs (₹50)

Step 1: Creator A posts debate
  - Creator pays ₹10.00 (1000 paise)
  - IndoBid receives: ₹10.00
  - Creator A wallet: ₹0.00 (Self-stake)

Step 2: User B responds with ₹11.00 (1100 paise)
  - User B pays ₹11.00
  - Creator A reward (50%): ₹5.50 (550 paise)
  - IndoBid platform fee (50%): ₹5.50 (550 paise)

Step 3: User C responds with ₹50.00 (5000 paise)
  - User C pays ₹50.00
  - Creator A reward (50%): ₹25.00 (2500 paise)
  - IndoBid platform fee (50%): ₹25.00 (2500 paise)

TOTALS:
  - Gross Debate Value: ₹71.00 (7100 paise)
  - Creator A Total Earnings: ₹30.50 (3050 paise)
  - IndoBid Protocol Net Revenue: ₹40.50 (4050 paise)
```

---

# PART 34 — COMPLETE SYSTEM EVENT FLOWS

```
[ User Action: Challenge / Back an Opinion ]
                    │
                    ▼
     POST /api/debates/[id]/continue
  (Validates: amount >= lastAmount + 100 paise)
                    │
                    ▼
          Razorpay Order Created
                    │
                    ▼
          Client Completes UPI / Card
                    │
                    ▼
          POST /api/payments/verify
   (Server verifies HMAC SHA-256 Signature)
                    │
                    ▼
         Prisma Transaction Execution:
  1. Create Contribution (status: 'verified')
  2. Increment Debate Total & Count
  3. Create CreatorEarningsLedger (50% Split)
  4. Create DebateActivityEvent
  5. Create Notification for Debate Author
                    │
                    ▼
         Client View Updates Optimistically
```

---

# PART 35 — CODEBASE DIRECTORY & FILE MAP

```
indobid.lol/
├── prisma/
│   └── schema.prisma              # 23 Database models, relations, indexes
├── public/
│   ├── favicon.svg                # Vector browser tab favicon
│   └── icon.svg                   # Vector 512x512 app icon
├── src/
│   ├── app/
│   │   ├── api/                   # 25+ REST API routes
│   │   ├── debate/[id]/           # Debate room view & financial stats
│   │   ├── profile/[username]/    # User profile & Appearance settings
│   │   ├── explore/               # Discovery & multi-category search
│   │   ├── trending/              # Financial momentum leaderboard
│   │   ├── activity/              # Live conviction stream
│   │   ├── messages/              # Direct messaging center
│   │   ├── notifications/         # Activity inbox
│   │   ├── saved/                 # Bookmarks collection
│   │   ├── admin/                 # Operational management dashboard
│   │   ├── reset-password/        # Cryptographic reset flow
│   │   ├── layout.tsx             # Root layout, metadata, anti-flash script
│   │   ├── globals.css            # Color variables & typography
│   │   └── page.tsx               # Primary application feed
│   ├── components/                # Modular React UI components
│   │   ├── Sidebar.tsx            # Fixed desktop left navigation
│   │   ├── RightSidebar.tsx       # Fixed desktop right trending sidebar
│   │   ├── BottomNav.tsx          # Mobile bottom navigation bar
│   │   ├── Navbar.tsx             # Top search & notifications header
│   │   ├── Footer.tsx             # 4-column corporate footer
│   │   ├── DebateCard.tsx         # Post card with author 3-dots menu
│   │   ├── CreateDebateModal.tsx  # Opinion composer & ₹10 quality gate
│   │   ├── AuthModal.tsx          # Login, Signup, OTP & Reset modal
│   │   └── Logo.tsx               # INDO BID brand wordmark & monogram
│   ├── context/
│   │   ├── AuthContext.tsx        # Authentication provider & state
│   │   └── ThemeContext.tsx       # Dark / Light / System theme provider
│   └── lib/                       # Core business logic & security libraries
│       ├── creator-economics.ts   # 50/50 revenue split engine
│       ├── money.ts               # Integer paise monetary constants
│       ├── user-auth.ts           # PBKDF2 password & session cookies
│       ├── email-otp.ts           # 6-digit OTP generation & Resend delivery
│       ├── password-reset.ts      # Cryptographic reset tokens
│       ├── founder.ts             # Authoritative founder validation
│       ├── trending.ts            # Trending ranking formula
│       └── debates.ts             # Feed queries & debate aggregation
└── tests/
    └── run-all-tests.ts           # 109 Automated end-to-end test suite
```

---

# PART 36 — "WHERE DOES THIS RULE LIVE?" GUIDE

```
┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Business / Security Rule             │ Source File Path & Line / Function                     │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ ₹10 Minimum Creation Floor           │ src/lib/money.ts (MIN_ORIGINAL_CONTRIBUTION_PAISE)     │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ +₹1 Continuation Step-Up Rule        │ src/lib/money.ts (MIN_INCREMENT_PAISE)                 │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 50 / 50 Creator Revenue Split        │ src/lib/creator-economics.ts (CREATOR_SHARE_BPS=5000)  │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Founder Identity & Free Publishing   │ src/lib/founder.ts (isFounder, getOrCreateFounderUser) │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 6-Digit Email OTP Security           │ src/lib/email-otp.ts (generateOtpCode, verifyEmailOtp) │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ PBKDF2 Password Hashing (100k rounds)│ src/lib/user-auth.ts (hashPassword, verifyPassword)    │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Session Cookie Security Flags        │ src/lib/user-auth.ts (createUserSession, verifySession)│
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Razorpay Signature Verification      │ src/app/api/payments/verify/route.ts                   │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Trending Score Algorithm             │ src/lib/trending.ts (calculateTrendingScore)           │
├──────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Author Post Edit/Hide Authorization  │ src/app/api/debates/[id]/route.ts (PATCH, DELETE)      │
└──────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

# PART 37 — TESTING SUITE & VERIFICATION MATRIX

### 37.1 Test Suite Breakdown (`tests/run-all-tests.ts`)

```
========================================================================================
                      INDOBID AUTOMATED TEST SUITE (109 / 109 PASSING)
========================================================================================
• Part 1: Money & Financial Arithmetic (Tests 1 - 20)           ───► 20/20 PASS (100%)
• Part 2: Debate Lifecycle & Social Graph (Tests 21 - 38)       ───► 18/18 PASS (100%)
• Part 3: User Authentication & Creator Economy (Tests 39 - 63) ───► 25/25 PASS (100%)
• Part 4: Founder Privileges & Admin Suite (Tests 64 - 75)      ───► 12/12 PASS (100%)
• Part 5: Author Editing, Mentions & Alerts (Tests 76 - 80)     ───►  5/5  PASS (100%)
• Part 6: Email OTP Verification Engine (Tests 81 - 98)         ───► 18/18 PASS (100%)
• Part 7: Password Reset & Recovery Security (Tests 99 - 106)   ───►  8/8  PASS (100%)
• Part 8: Post Hiding, Permissions & Integrity (Tests 107 - 109)───►  3/3  PASS (100%)
========================================================================================
TOTAL TEST SUITE RESULT: 109 PASSED | 0 FAILED | 0 SKIPPED (100% GREEN)
========================================================================================
```

---

# PART 38 — BUILD, DEPLOYMENT & LOCAL SETUP

### 38.1 Local Development Commands
1. **Install Dependencies**: `npm install`
2. **Generate Database Client**: `npx prisma generate`
3. **Push Database Schema**: `npx prisma db push`
4. **Run TypeScript Check**: `npx tsc --noEmit`
5. **Run Test Suite**: `npx tsx tests/run-all-tests.ts`
6. **Start Dev Server**: `npm run dev`
7. **Production Build**: `npm run build`

---

# PART 39 — ERROR HANDLING & FAILURE RESPONSES

- **Payment Failure**: Post remains in `status: 'pending_payment'` and is omitted from public feeds.
- **Wrong OTP Code**: Increments `attempts`. Reaching 5 attempts permanently locks code.
- **Short Arguments**: Rejected with `{ error: 'Opinion argument must be at least 10 characters' }`.
- **Unauthorized Edit**: Returns `403 Forbidden` with `{ error: 'Unauthorized to edit this post' }`.

---

# PART 40 — PERFORMANCE & SCALABILITY REVIEW

- **Composite Database Indexes**: Defined across all frequent query paths (`[status, trendingScore]`, `[status, totalVerifiedContribution]`, `[authorUsername]`).
- **Static Route Optimization**: 29 routes pre-compiled via Next.js Turbopack in 701ms.
- **Connection Pooling**: PostgreSQL connections managed via Prisma Client singleton.

---

# PART 41 — MOBILE-FIRST ARCHITECTURE

- **Desktop Shell**: Fixed Left Sidebar (`w-[280px]`) + Fixed Right Sidebar (`w-80`) + Center Scrollable Feed (`max-w-2xl`).
- **Mobile Viewport**: Sidebars gracefully collapse; bottom navigation bar (`BottomNav.tsx`) renders with center floating `+ Start Conversation` action button.

---

# PART 42 — PRODUCT STATE & COMPLETENESS REVIEW

```
┌──────────────────────────────┬────────────────────────┬───────────────────────────────────────────┐
│ Feature Domain               │ Status                 │ Production Readiness                      │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Core Debate Marketplace      │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ 50/50 Creator Economics      │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Email OTP Authentication     │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Password Reset Engine        │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Razorpay Gateway Integration │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Author Post Edit & Hide      │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Social Graph (DMs, Follow)   │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Dark/Light/System Themes     │ COMPLETE               │ 100% Production Ready                     │
├──────────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ Admin Operations Suite       │ COMPLETE               │ 100% Production Ready                     │
└──────────────────────────────┴────────────────────────┴───────────────────────────────────────────┘
```

---

# PART 43 — "EXPLAIN INDOBID IN 5 MINUTES" (FOUNDER PITCH)

> "Traditional social media is broken because attention is free. Anyone can create 1,000 bot accounts, post outrage bait, and drown out thoughtful arguments.
> 
> **IndoBid fixes this with skin in the game.**
> 
> On IndoBid, reading is completely free for everyone. But to post an official opinion, you must stake ₹10. To challenge someone or back an argument, you must pay +₹1 more than the previous person.
> 
> When people back your opinion, **you earn 50% of their money**.
> 
> On IndoBid, you don't measure an opinion by how many casual likes it received. You measure it by how much value people were willing to put behind it."

---

# PART 44 — "INDOBID FOR A NEW ENGINEER" (ONBOARDING)

### Recommended Reading Order for Developers:
1. `prisma/schema.prisma` — Master database models and foreign key relations.
2. `src/lib/money.ts` — Integer monetary rules (₹10 floor, +₹1 step-up).
3. `src/lib/creator-economics.ts` — 50/50 split and ledger accounting.
4. `src/lib/user-auth.ts` & `src/lib/email-otp.ts` — PBKDF2 hashing, sessions, and OTP security.
5. `src/app/api/debates/route.ts` & `src/app/api/payments/verify/route.ts` — Post creation & payment verification.
6. `tests/run-all-tests.ts` — Complete suite of 109 automated regression tests.

---

# PART 45 — "DO NOT BREAK THESE RULES" (SYSTEM INVARIANTS)

1. **INTEGER PAISE INVARIANT**: Never calculate money in floating-point rupees. All monetary fields must remain integer paise.
2. **SERVER-SIDE SIGNATURE INVARIANT**: Never trust client payment success callbacks. Always verify Razorpay HMAC-SHA256 signatures server-side.
3. **50/50 REVENUE INVARIANT**: `CREATOR_SHARE_BPS` must strictly equal `5000` (50.00%).
4. **SELF-STAKE REWARD INVARIANT**: Creator self-stakes (Sequence #1 and own replies) must never generate creator earnings.
5. **ZERO CLIENT TRUST INVARIANT**: Request body flags (`isFounder`, `role`, `isVerified`) must never grant privileges. Validate sessions server-side.
6. **SOFT-DELETE INTEGRITY**: Regular authors must never hard-delete posts from the database.

---

# PART 46 — FINAL EXECUTIVE SUMMARY

IndoBid is an editorial social marketplace for high-conviction opinions and structured discussions. It introduces economic skin-in-the-game to online discourse through a ₹10 creation floor, a +₹1 continuation step-up rule, a 50/50 creator-platform revenue split, and server-authoritative cryptographic verification.

The platform is fully implemented, strictly typed in TypeScript, covered by 109 automated tests, compiled cleanly under Next.js 16.3.3 Turbopack, and operates with a clean production PostgreSQL database.

---

# FINAL SYSTEM HEALTH REPORT

- **Product Integrity**: **EXCELLENT (10/10)** — PRD v1.0 specifications fully realized.
- **Architecture**: **EXCELLENT (10/10)** — Clean App Router structure with modular separation.
- **Database**: **EXCELLENT (10/10)** — PostgreSQL schema with composite indexes and referential integrity.
- **Authentication**: **EXCELLENT (10/10)** — PBKDF2 (100k rounds) + 6-digit Resend Email OTP + HMAC cookies.
- **Payments**: **EXCELLENT (10/10)** — Cryptographic HMAC-SHA256 signature verification & idempotent ledgers.
- **Creator Economics**: **EXCELLENT (10/10)** — Exact 50/50 mathematical split with self-stake isolation.
- **Social Layer**: **EXCELLENT (10/10)** — Free reading, optimistic likes, bookmarks, DMs, and activity feeds.
- **Admin & Founder**: **EXCELLENT (10/10)** — Authoritative founder validation and operational dashboard.
- **Security**: **EXCELLENT (10/10)** — Zero client trust, enum defense, and parameterization.
- **Testing**: **EXCELLENT (10/10)** — 109 / 109 automated end-to-end tests passing (100% green).
- **Build Health**: **EXCELLENT (10/10)** — TypeScript 0 errors, Next.js 29 routes compiled cleanly.
- **Production Readiness**: **100% READY FOR GLOBAL PRODUCTION LAUNCH**.

---

# OPEN ISSUES / RISKS

1. **No Open Blocking Vulnerabilities**: All core authentication, authorization, and payment flows are validated.
2. **Third-Party Dependency**: Reliance on Resend for email delivery requires maintaining active API credits.
3. **Manual Payout Review**: Payouts require administrator review (intentional security design for launch safety).

---

# RECOMMENDED NEXT STEPS

1. **Production Deployment**: Deploy the audited codebase to production hosting (Vercel / AWS).
2. **Domain & DNS Verification**: Ensure `indobid.lol` DNS records and SPF/DKIM for `noreply@indobid.lol` are active in Resend.
3. **Gateway Activation**: Verify live Razorpay production keys in the hosting environment.
