# INDOBID — DATA SAFETY & PRESERVATION PROTOCOL

---

## 1. Strict Non-Destructive Posture
IndoBid enforces a zero data-loss posture across all environments:
1. **Never Drop Tables**: Historical data structures (such as legacy `listings`, `bids`, `clicks`) remain safely defined in the schema to ensure backward compatibility and avoid breaking legacy records.
2. **Never Truncate Data**: Test data, analytics records, and user content are never truncated or wiped.
3. **Never Run `migrate reset`**: Production database migrations are executed exclusively via `npx prisma migrate deploy` in forward-only incremental steps.

---

## 2. Double-Entry Integrity
The creator economics engine uses an append-only ledger pattern:
* No record is permanently deleted upon reversal; instead, status transitions to `reversed` with an explicit timestamp and reason.
* Database foreign keys and unique constraints on `[contributionId, idempotencyKey]` protect against double payouts or duplicate crediting.
