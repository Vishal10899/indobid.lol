# INDOBID — DEPLOYMENT & PRODUCTION INFRASTRUCTURE SPECIFICATION

---

## 1. Hosting Architecture
* **Frontend & Backend**: Next.js 16 Web Service running on Node.js 18+ (Render Container Runtime)
* **Edge CDN & Ingress**: Cloudflare Edge (TLS 1.3 Termination, DNS for `indobid.lol`)
* **Database**: Managed PostgreSQL Cloud Instance over TLS 1.3 (`?sslmode=require`)

---

## 2. CI/CD Build & Deployment Pipeline
```bash
# 1. Dependency Installation
npm ci

# 2. Prisma Client Generation
npx prisma generate

# 3. Non-Destructive Migration Deployment
npx prisma migrate deploy

# 4. Production Next.js Build
npm run build

# 5. Production Server Launch
npm run start
```

---

## 3. Stateless Scale-Out Architecture
Application instances are completely stateless:
* No local filesystem session storage
* Rate limiting abstracts to Redis
* Session validation uses HMAC signed cookies verified against shared `AUTH_SECRET`
