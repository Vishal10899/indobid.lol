# INDOBID — SYSTEM ARCHITECTURE SPECIFICATION

---

## 1. Architectural Philosophy & Principles

IndoBid is structured as a **Modular Layered Architecture** with strict separation of concerns, high maintainability, and zero vendor lock-in.

```text
UI (React 19 / Next.js 16)
       │
       ▼
API Controllers (src/app/api/*)
       │
       ▼
Application Services (src/modules/*)
       │
       ▼
Domain & Infrastructure Repositories (src/infrastructure/*)
       │
       ▼
Database (PostgreSQL) / External Providers (Razorpay, Resend)
```

---

## 2. Core Architectural Invariants
* **Strict Integer Math**: All financial transactions and calculations are performed in integer **paise** ($1\text{ USD} = 100\text{ paise}$, $2\text{ USD} = 200\text{ paise}$).
* **50/50 Creator Revenue Split**: Verified community supporter contributions allocate **50% to the Creator** and **50% to the Platform Protocol** in an immutable double-entry ledger.
* **0% Self-Support Rule**: Author starting stakes (`sequence === 1`) and self-continuations generate strictly **$0.00** in creator rewards.
* **Three Locked Feed Modes**: Discovery is strictly organized into **For You**, **Trending**, and **Following**.
* **Server-Authoritative Authority**: Founder role and elevated privileges are locked to normalized `ADMIN_EMAIL`.

---

## 3. Directory Layout & Module Responsibilities

| Directory | Responsibility | Key Submodules |
| :--- | :--- | :--- |
| `src/config/` | Centralized validated configuration & constants | `env.ts`, `app.ts`, `security.ts`, `features.ts` |
| `src/lib/` | Low-level utilities, errors, money math, security primitives | `errors/`, `money/`, `security/`, `rate-limit/` |
| `src/infrastructure/` | Persistence, vendor SDK adapters, cache, queue, storage | `database/`, `payments/`, `storage/`, `email/`, `cache/`, `queue/`, `logging/` |
| `src/modules/` | Domain business logic, use-case workflows, services | `auth/`, `users/`, `debates/`, `social/`, `feed/`, `payments/`, `creator-economics/`, `notifications/`, `media/`, `moderation/` |
| `src/shared/` | Cross-cutting types, validation schemas, and constants | `types/`, `constants/`, `schemas/` |
| `src/app/` | Thin Next.js 16 App Router pages and API controllers | `(public)/`, `(auth)/`, `admin/`, `api/` |
| `docs/` | Comprehensive architecture, security, and developer guides | 15 detailed documentation files |
