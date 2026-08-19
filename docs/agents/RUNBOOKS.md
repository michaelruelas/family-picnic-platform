# Operational Runbooks

Step-by-step procedures for incidents that are too rare to memorize but too
urgent to figure out from scratch. Add a section when a runbook is created;
update the "Last verified" date when the steps still match reality.

| Runbook                                                       | Trigger                                                                    | Last verified |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------- |
| [Restore lost potluck signups](#restore-lost-potluck-signups) | PotluckSignup rows missing or soft-deleted for one event, audit log intact | 2026-08-19    |

---

## Restore lost potluck signups

### Symptom

A user reports missing potluck dishes for an event. The slot counters on
LIMITED slots look correct (they were never decremented), but the
`PotluckSignup` table has zero rows for that event. The
`AuditLog` table still has the original `potluck.signup.create` and
`potluck.signup.update` entries.

This runbook also covers the recovery path if you ever need to
un-soft-delete rows: the script forces `deletedAt = null`, so re-running
it on a soft-deleted row resurrects it.

### Background

The `PotluckSignup` table is now soft-deletable
(`deletedAt DateTime?`) and protected by the
`PotluckSignup_no_delete` trigger (see
`prisma/migrations/20260819130000_potluck_signup_soft_delete_and_protect/`).
A direct `DELETE FROM "PotluckSignup"` raises an exception; the only
way to remove rows is `UPDATE … SET "deletedAt" = NOW()`. The restore
script works either way — it inserts with `deletedAt = null`, so a row
that already exists in soft-delete state is un-deleted, not duplicated.

### Pre-flight

1. **Confirm the data is actually missing**, not just hidden. Soft-deleted
   rows are filtered out everywhere users see, so "missing" can also mean
   "soft-deleted". Run this query — if it returns rows, the data is alive
   but hidden, and the restore is unnecessary:

   ```sql
   SELECT id, "dishName", "deletedAt"
   FROM "PotluckSignup" ps
   JOIN "PotluckSlot" s ON s.id = ps."slotId"
   WHERE s."eventId" = '<event-id>'
     AND ps."deletedAt" IS NOT NULL;
   ```

2. **Export the relevant `AuditLog` rows to a CSV** for the script to
   consume. A SQL query like this gets you the right shape:

   ```sql
   \copy (
     SELECT id, action, "actorId", "occurredAt",
            payload::text, "subjectId", "subjectType"
     FROM "AuditLog"
     WHERE "subjectType" = 'PotluckSignup'
       AND payload->>'eventId' = '<event-id>'
     ORDER BY "occurredAt" ASC
   ) TO '/tmp/potluck-restore/public-AuditLog-selection.csv' WITH CSV HEADER;
   ```

   Adjust the column order / quoting if your `psql` version differs. The
   script's parser expects: `id, action, actorId, occurredAt, payload,
subjectId, subjectType` with the payload wrapped in literal `"` and
   inner `"` escaped as `""` (the standard CSV convention).

3. **Verify the script can resolve every `actorId` to an `RSVP`** for the
   affected event. The script aborts loudly if any `actorId` is missing,
   so this is the safety net. If the lookup fails, check whether the
   `actorId` is a known test user, a deleted user, or an admin account.

### Run the restore

The script lives at `scripts/restore-potluck-signups.ts` and is idempotent
(upserts by original cuid). It dry-runs by default — `--apply` commits.

```bash
# dry-run: shows what would be written, no DB writes
bun scripts/restore-potluck-signups.ts

# commit (one-shot; safe to re-run, second run reports 0 created)
bun scripts/restore-potluck-signups.ts --apply
```

The script exits non-zero on any failure (missing CSV, missing RSVP, bad
payload). A clean run prints:

```
Done. Created N, updated-existing M, restored-from-soft-delete K,
update-events applied T. Total PotluckSignup rows for restored subjectIds:
N+M+K / expected.
```

### Verify

```sql
SELECT COUNT(*) FROM "PotluckSignup" ps
JOIN "PotluckSlot" s ON s.id = ps."slotId"
WHERE s."eventId" = '<event-id>'
  AND ps."deletedAt" IS NULL;
```

Expected = number of distinct `potluck.signup.create` rows in the audit
log for that event. If `currentSignups` on a LIMITED slot is wrong
(mismatch between counter and actual rows), the slot was already in a
bad state before the incident — fix the counter separately with an
explicit `UPDATE "PotluckSlot" SET "currentSignups" = <count> WHERE id = …`.

### What NOT to do

- **Do not bypass the DB trigger** by disabling it. The trigger is the
  safety net. The only legitimate bypass is `SET LOCAL
app.potluck_signup_allow_hard_delete = 'true'` inside a transaction,
  which is wired into the `deleteSlot` router and the admin event DELETE
  handler. Anything else is wrong.
- **Do not write directly to the production DB via a port-forwarded
  `psql`** without a written justification. The 2026-08-19 incident
  started with an out-of-band `DELETE` against a port-forwarded prod
  database. Use the port-forward for read-only diagnostics; route all
  writes through the application code or the migration tooling.
- **Do not re-run a migration that drops the `PotluckSignup` table**.
  The audit log only survives because it has its own trigger; the
  signup table doesn't.

### Root cause of the 2026-08-19 incident

All 19 `PotluckSignup` rows for event `cmsyr224x000001qjoskdhbyd` were
hard-deleted in a single statement. The deletion was out-of-band — no
`AdminAuditLog` row, no `AuditLog` row, no slot-counter decrement, no
cascade from a parent delete (the event, slots, and RSVPs all survived
intact). The local `.env` was pointing at a port-forwarded production
database, so any `bun -e '…prisma…'` from this checkout was hitting
prod. The exact `DELETE` statement and the connecting user are in the
Postgres server log (`pg_log`) for the 20:25–20:40 UTC window on
2026-08-19 — pull that next time before the log rotates.

The follow-up hardening (this runbook's reason for existing):

1. `PotluckSignup` now has a `deletedAt` column and a
   `PotluckSignup_no_delete` DB trigger (see migration
   `20260819130000_potluck_signup_soft_delete_and_protect`). Hard delete
   is only possible via the explicit `SET LOCAL` opt-in used by
   `deleteSlot` and the admin event DELETE handler.
2. Every read path filters `deletedAt: null` so soft-deleted rows never
   surface to users.
3. `.gitignore` includes `family-picnic-*-secrets.txt` so the OpenBao
   secret-export files never get committed by accident.
