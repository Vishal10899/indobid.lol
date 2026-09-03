# INDOBID — PRODUCTION DEPLOYMENT & HOSTING INDEPENDENCE GUIDE

**Document Version:** 2.0.0  
**Status:** Multi-Cloud Deployment Playbook  

---

## 1. Hosting Independence Architecture

IndoBid is packaged as a portable Node.js / Docker application. It has zero hardcoded ties to any specific cloud vendor. 

All environment-specific configuration is injected strictly via environment variables conforming to `src/config/env.ts`.

---

## 2. Standard Build & Runtime Commands

* **Dependencies Installation:** `npm ci`
* **Prisma Client Generation:** `npx prisma generate`
* **Production Build:** `npm run build`
* **Production Start:** `npm start`
* **Database Migration:** `npx prisma migrate deploy`
* **Health Check Probes:**
  * Liveness: `GET /api/health` (HTTP 200 `{ status: "ok" }`)
  * Readiness: `GET /api/ready` (HTTP 200 `{ status: "ready", database: "connected" }`)

---

## 3. Platform Deployment Guides

### 3.1 Deploying to Render (Current Primary)
1. **Service Type:** Web Service (Node.js runtime).
2. **Build Command:** `npm ci && npx prisma generate && npm run build`
3. **Start Command:** `npx prisma migrate deploy && npm start`
4. **Health Check Path:** `/api/health`
5. **Auto-Deploy:** Enabled on `main` branch.

### 3.2 Deploying to Vercel
1. **Framework Preset:** Next.js.
2. **Root Directory:** `./`
3. **Build Command:** `prisma generate && next build`
4. **Output Directory:** `.next`
5. **Environment Variables:** Populate `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_SECRET_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, etc.

### 3.3 Deploying via Docker / Self-Hosted VPS
Create standard Dockerfile:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

### 3.4 Deploying to Railway / Fly.io / AWS ECS
* Standard Node.js 20 container image.
* Configure managed PostgreSQL database URL.
* Inject environment variables.
* Point load balancer health checks to `/api/health`.

---

## 4. Required Production Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | YES | PostgreSQL connection string with SSL. |
| `SESSION_SECRET` | YES | 64+ char random key for HMAC session signing. |
| `ADMIN_SECRET_KEY` | YES | Secret key for administrative endpoints. |
| `ADMIN_EMAIL` | YES | Canonical founder email (`vishalkumar75912@gmail.com`). |
| `RAZORPAY_KEY_ID` | YES | Gateway public identifier. |
| `RAZORPAY_KEY_SECRET` | YES | Gateway private secret. |
| `RAZORPAY_WEBHOOK_SECRET` | YES | Webhook signature verification secret. |
| `RESEND_API_KEY` | YES | Transactional email dispatch key. |
| `NEXT_PUBLIC_APP_URL` | YES | Canonical domain (`https://indobid.lol`). |

---

## 5. Common Deployment Issues & Solutions

1. **Prisma Engine Binary Mismatch:**
   * *Symptom:* `PrismaClientInitializationError: Query engine not found`.
   * *Fix:* Ensure `npx prisma generate` runs inside the target container environment before `npm run build`.
2. **Database Connection Pool Exhaustion:**
   * *Symptom:* `Timed out fetching a connection from the pool`.
   * *Fix:* Configure `connection_limit=10&pool_timeout=20` on `DATABASE_URL`.
3. **Webhook Signature Verification Failures:**
   * *Symptom:* Webhooks return HTTP 400 `Invalid signature`.
   * *Fix:* Verify that `RAZORPAY_WEBHOOK_SECRET` matches the secret registered in the Razorpay Dashboard.
