-- FPP-Postmortem: protect PotluckSignup from accidental wipe.
--
-- On 2026-08-19 all 19 PotluckSignup rows for one event were hard-deleted
-- out-of-band (likely a manual psql/Studio query against a port-forwarded
-- prod DB). The AuditLog survived because it has an append-only DB
-- trigger; PotluckSignup had no equivalent protection. Two changes here:
--
--   1. Soft-delete column `deletedAt` so application cancel paths mark
--      rows instead of removing them. Every read path filters
--      `deletedAt: null` so users never see soft-deleted rows.
--   2. `BEFORE DELETE` trigger that raises an exception on any direct
--      DELETE. The application never hard-deletes (cancel paths set
--      `deletedAt`). The only legitimate hard-delete path is a migration
--      that needs to scrub rows; it opts in via
--      `SET LOCAL app.potluck_signup_allow_hard_delete = 'true'` and
--      runs inside the same transaction as the DELETE. A `BEFORE UPDATE`
--      trigger blocks direct UPDATEs on soft-deleted rows so a stray
--      `UPDATE ... WHERE id = X` doesn't resurrect a cancelled signup's
--      dish name; cancel paths always filter on `deletedAt: null`.

-- AlterTable
ALTER TABLE "PotluckSignup" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PotluckSignup_deletedAt_idx" ON "PotluckSignup"("deletedAt");

-- Block direct DELETE: any statement that fires this trigger raises an
-- exception. The only way to bypass is to set the session-local flag
-- inside the same transaction, which the application code never does.
-- Cascade deletes from `Event`/`PotluckSlot` deletion still fire this
-- trigger — those callers (admin event DELETE, deleteSlot router) wrap
-- their DELETE in a transaction that sets the flag first.
CREATE OR REPLACE FUNCTION potluck_signup_protect_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.potluck_signup_allow_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'PotluckSignup rows cannot be hard-deleted directly. Use the deletedAt column for soft-delete. Migrations that genuinely need to remove rows must run `SET LOCAL app.potluck_signup_allow_hard_delete = ''true''` inside the same transaction as the DELETE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PotluckSignup_no_delete"
BEFORE DELETE ON "PotluckSignup"
FOR EACH ROW EXECUTE FUNCTION potluck_signup_protect_delete();

-- Block direct UPDATE on soft-deleted rows. A stray `UPDATE
-- "PotluckSignup" SET dishName = 'x' WHERE id = Y` would otherwise let a
-- script "edit" a row that the user already cancelled. Soft-deleted
-- rows can only be resurrected by an explicit `deletedAt: null` set,
-- which the admin restore script uses (`scripts/restore-potluck-signups.ts`).
CREATE OR REPLACE FUNCTION potluck_signup_protect_update_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."deletedAt" IS NULL THEN
    RETURN NEW;
  END IF;
  -- Allow an explicit un-delete (`deletedAt = NULL`) so the restore
  -- script and any future operator-initiated un-cancel can recover a
  -- soft-deleted row. Block everything else.
  IF NEW."deletedAt" IS NULL AND OLD."deletedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PotluckSignup row is soft-deleted (deletedAt=%); only an explicit deletedAt = NULL reset is allowed', OLD."deletedAt";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PotluckSignup_no_update_deleted"
BEFORE UPDATE ON "PotluckSignup"
FOR EACH ROW EXECUTE FUNCTION potluck_signup_protect_update_deleted();
