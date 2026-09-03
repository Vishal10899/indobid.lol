# INDOBID — DATA SAFETY, DATABASE PRESERVATION & BACKUP PROTOCOL

**Document Version:** 2.0.0  
**Status:** Authoritative Data Protection Policy  

---

## 1. Core Distinction: Prisma vs PostgreSQL vs Backups

| Component | Nature | Role in System | Disaster Recovery Capability |
| :--- | :--- | :--- | :--- |
| **Prisma ORM** | Application Layer | Database access, type-safe queries, migration scripts (`schema.prisma`) | **ZERO data recovery.** Prisma does NOT store, backup, or recover data. |
| **PostgreSQL 16** | Persistent Datastore | Physical storage of tables, rows, indices, and transactions on Render disk | Stores current live state. Susceptible to disk failure without external snapshots. |
| **Backup Provider** | Infrastructure Storage | Periodic immutable snapshots, WAL archives, and offsite dumps | **Authoritative recovery source** for point-in-time restoration. |

---

## 2. Strict Non-Destructive Posture

IndoBid enforces a strict zero-data-loss posture across all deployment and development environments:
1. **Destructive Command Ban:** Commands such as `prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, and unbounded `DELETE FROM` are strictly forbidden.
2. **Backward-Compatible Schema Evolutions:** When adding columns, always provide default values or declare them nullable. Never remove or rename a column without a two-phase expand-and-contract deployment.
3. **Soft Deletions:** Debates and user accounts use status flags (`status = 'hidden'`, `isSuspended = true`) rather than SQL `DELETE`, guaranteeing audit permanence for tax, compliance, and dispute resolution.

---

## 3. Production Backups & Point-in-Time Recovery (PITR)

* **Managed Hosting Snapshots:** Render Managed PostgreSQL performs automated daily snapshots with 7-day retention.
* **Point-In-Time Recovery (PITR):** Write-Ahead Logs (WAL) are archived continuously, allowing rollback to any specific second within the 7-day window.
* **Manual Snapshot Execution:**
  ```bash
  pg_dump -Fc --no-acl --no-owner -h <host> -U <user> -d indobid_db > indobid_backup_$(date +%Y%m%d_%H%M%S).dump
  ```

---

## 4. Restoration & Recovery Runbook

1. Provision or identify the target database instance.
2. Restore the dump file using PostgreSQL binary tools:
   ```bash
   pg_restore --clean --if-exists --no-acl --no-owner -h <host> -U <user> -d indobid_db <dump_file>
   ```
3. Run `npx prisma migrate deploy` to ensure schema consistency.
4. Verify database health via `GET /api/ready`.
5. Run the regression test suite against a staging instance to verify data invariants.

---

## 5. Append-Only Financial Ledger Integrity

The creator economics engine uses an append-only double-entry ledger pattern:
* Records in `creator_earnings_ledgers` are never deleted upon refund or dispute. Instead, their status transitions to `reversed` with an explicit `reversedAt` timestamp and `reversalReason`.
* Database foreign keys and unique constraints on `contributionId` and `idempotencyKey` protect against duplicate crediting or financial replay attacks at the relational engine level.
