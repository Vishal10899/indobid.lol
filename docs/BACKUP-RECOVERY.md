# INDOBID — BACKUP, DISASTER RECOVERY & LEDGER RECONSTRUCTION RUNBOOK

**Document Version:** 2.0.0  
**Status:** Operational Production Runbook  

---

## 1. Database Backup Strategy

1. **Automated Continuous Backups:** Managed PostgreSQL on Render performs automated daily snapshots with 7-day retention.
2. **Point-In-Time Recovery (PITR):** WAL (Write-Ahead Logging) archiving enables granular point-in-time rollbacks to any second within the past 7 days.
3. **Manual Backup Dump Command:**
   ```bash
   pg_dump -Fc --no-acl --no-owner -h <host> -U <user> -d indobid_db > indobid_backup_$(date +%Y%m%d_%H%M%S).dump
   ```
4. **Backup Restoration Command:**
   ```bash
   pg_restore --clean --if-exists --no-acl --no-owner -h <host> -U <user> -d indobid_db indobid_backup_<timestamp>.dump
   ```

---

## 2. Deterministic Ledger Reconstruction Procedure

In the extreme event that the `creator_earnings_ledgers` table is corrupted or truncated, IndoBid's architecture allows **100% deterministic reconstruction** of the entire creator economy directly from immutable verified `contributions` and `debates`.

### Reconstruction Algorithm:
1. Identify all verified contributions:
   ```sql
   SELECT c.id, c.debate_id, c.author_username, c.amount, c.sequence, d.author_username as debate_author, c.verified_at
   FROM contributions c
   JOIN debates d ON c.debate_id = d.id
   WHERE c.status = 'verified'
   ORDER BY c.verified_at ASC;
   ```
2. For each verified contribution:
   * If `c.author_username == d.author_username` or `c.sequence == 1`:
     * It is an author self-stake.
     * `creatorRewardPaise = 0`
     * `platformFeePaise = c.amount`
   * If `c.author_username != d.author_username`:
     * It is a community backer contribution.
     * `creatorRewardPaise = Math.floor(c.amount * 5000 / 10000)` (50%)
     * `platformFeePaise = c.amount - creatorRewardPaise` (50%)
3. Insert reconstructed records with deterministic idempotency key `recon_${contribution.id}`.

---

## 3. Disaster Recovery Runbooks

### Scenario A: Total Database Loss
1. Provision a fresh PostgreSQL 16 instance.
2. Restore the latest automated backup or point-in-time snapshot via Render dashboard.
3. Run `npx prisma migrate deploy` to ensure schema consistency.
4. Verify database connectivity via `GET /api/ready`.
5. Execute `npx tsx tests/run-all-tests.ts` against a staging clone to verify invariants.

### Scenario B: Payment Gateway Desynchronization (Missed Webhooks)
1. Query Razorpay API for all payments with status `captured` within the desynchronization window:
   ```bash
   curl -u <KEY_ID>:<SECRET> "https://api.razorpay.com/v1/payments?from=<TIMESTAMP>&status=captured"
   ```
2. For each captured payment ID not present in `payments` table:
   * Invoke `paymentService.processSuccessfulPayment({ providerPaymentId, amountPaise, ... })`.
   * The ACID transaction idempotently activates the debate or continuation and creates the ledger entry.

### Scenario C: Corrupted Trending & Feed Scores
1. If feed ranking scores become stale or out of sync:
2. Execute the re-scoring routine:
   ```bash
   npx tsx -e "import { debateRepository } from './src/infrastructure/database/repositories'; import { updateDebateTrendingScore } from './src/modules/debates'; async function fix() { const debates = await debateRepository.findMany({ where: { status: 'active' } }); for (const d of debates) { await updateDebateTrendingScore(d.id); } } fix();"
   ```
3. Scores will be recomputed using the latest 24h/7d contribution velocity, engagement logs, and half-life decay.

### Scenario D: Compromised Admin Secret Key
1. Generate a new cryptographically secure 64-character secret:
   ```bash
   openssl rand -hex 32
   ```
2. Immediately update `ADMIN_SECRET_KEY` in environment variables.
3. Trigger service redeploy. The previous key will be immediately invalidated across all endpoints.
4. Rotate `SESSION_SECRET` to invalidate all active admin and user sessions if necessary.
