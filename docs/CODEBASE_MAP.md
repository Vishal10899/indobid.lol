# INDOBID — CODEBASE DIRECTORY MAP & NAVIGATION

---

## Complete Tree & Directory Purpose

```text
indobid.lol/
├── docs/                                  # Comprehensive System Documentation
│   ├── ARCHITECTURE.md                    # System Overview & Module Responsibilities
│   ├── DATABASE.md                        # Database Schema & Model Catalog
│   ├── AUTHENTICATION.md                  # Session Security & PBKDF2 Password Hashing
│   ├── PAYMENTS.md                        # Razorpay & Creator Economics 50/50 Split
│   ├── FEED_ALGORITHM.md                  # Multi-Signal Ranking & Anti-Whale Logarithms
│   ├── SOCIAL_FEATURES.md                 # Likes, Follows, Bookmarks, Comments
│   ├── MEDIA.md                           # Magic Byte Image Validation & Storage
│   ├── DEPLOYMENT.md                      # Next.js 16 Production Hosting & Cloudflare Edge
│   ├── SECURITY.md                        # Timing-Safe Admin Verification & Controls
│   ├── ENVIRONMENT.md                     # Centralized Environment Variables
│   ├── TESTING.md                         # 193 Automated Test Suite Specifications
│   ├── TROUBLESHOOTING.md                 # Production Incident Runbooks
│   ├── CODEBASE_MAP.md                    # This File: Directory Map & Code Layout
│   ├── FEATURE_MAP.md                     # Product Capabilities & Implementation Status
│   └── DATA_SAFETY.md                     # Non-Destructive Data Preservation Posture
├── prisma/
│   ├── schema.prisma                      # PostgreSQL Data Schema (24 Models)
│   └── migrations/                        # SQL Migrations History
├── src/
│   ├── config/                            # Centralized Validated Configurations
│   │   ├── app.ts                         # Monetary & System Constraints
│   │   ├── env.ts                         # Centralized Environment Configuration
│   │   ├── features.ts                    # Feature Flags Configuration
│   │   ├── security.ts                    # Cryptographic & Security Calibration
│   │   └── index.ts                       # Config Aggregator
│   ├── infrastructure/                    # Low-level Data Access & Vendor Integrations
│   │   ├── cache/                         # ICacheProvider & Memory Cache
│   │   ├── database/                      # Prisma Singleton, Transactions, Repositories
│   │   ├── email/                         # IEmailProvider & Resend Adapter
│   │   ├── logging/                       # Structured Masked Logging Adapter
│   │   ├── payments/                      # IPaymentProvider & Razorpay Adapter
│   │   ├── queue/                         # IQueueProvider & Memory Queue
│   │   └── storage/                       # IStorageProvider & Binary Magic Byte Validation
│   ├── lib/                               # Core Primitives & Backward Compatibility Gateways
│   │   ├── errors/                        # AppError Hierarchy
│   │   ├── money/                         # Integer Paise & USD Formatting Arithmetic
│   │   ├── rate-limit/                    # In-Memory Sliding-Window Rate Limiter
│   │   ├── security/                      # PBKDF2, HMAC Sessions, Timing-Safe Admin
│   │   └── auth.ts, debates.ts, etc.      # Backward Compatibility Delegation Layer
│   ├── modules/                           # Domain Business Logic & Services
│   │   ├── auth/                          # Authentication Service & DTOs
│   │   ├── creator-economics/             # 50/50 Revenue Split & Ledger Service
│   │   ├── debates/                       # Debate Post Lifecycle Service
│   │   ├── feed/                          # For You, Trending, Following, Multi-Signal Ranking
│   │   ├── media/                         # Media Upload & Avatar Service
│   │   ├── moderation/                    # Moderation Reports & Resolution Service
│   │   ├── notifications/                 # In-App Activity Notification Service
│   │   ├── payments/                      # Checkout & Transactional Fulfillment Service
│   │   ├── social/                        # Likes, Bookmarks, Follows, Comments, Shares
│   │   └── users/                         # User Profile & Query Service
│   ├── shared/                            # Cross-Cutting Types, Constants & Schemas
│   ├── app/                               # Next.js 16 App Router UI & API Route Controllers
│   │   ├── (auth)/                        # /login, /signup, /verify, /forgot-password
│   │   ├── (public)/                      # /, /debate/[id], /profile/[username], /trending
│   │   ├── admin/                         # /admin Founder Control Console
│   │   └── api/                           # Thin REST API Route Handlers
│   └── components/                        # React 19 Client & Server UI Components
└── tests/
    └── run-all-tests.ts                   # 193 Automated Unit & Integration Tests
```
