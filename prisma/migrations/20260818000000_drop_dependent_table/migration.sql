-- Drop the Dependent model.
--
-- Background: HouseholdMember is the canonical roster for the household
-- going forward. The Dependent table duplicates the concept (same
-- `householdId`/`name`/`age`) and added a `managedByUserId` ownership
-- column plus a typed `Relationship` enum and `isChild` flag that no
-- other surface in the app reads. The FPP-107 migration
-- (20260803153210_household_member) already backfilled every active
-- Dependent into a HouseholdMember, so dropping the table is a no-op
-- for live data.
--
-- The household roster UI now reads `members` only; the dependent
-- router, the `/api/dependents` REST endpoints, the dependent schemas,
-- and the dependent-aware hooks were deleted alongside this migration.
-- The privacy policy, ADR-003, ADR-004, and the docs reference page
-- also drop the term.
--
-- Step 1: drop the CHECK constraint added in 20260817090000_fpp122_require_age.
ALTER TABLE "Dependent" DROP CONSTRAINT IF EXISTS "Dependent_age_check";

-- Step 2: drop the foreign keys so the table can be removed cleanly.
ALTER TABLE "Dependent" DROP CONSTRAINT IF EXISTS "Dependent_householdId_fkey";
ALTER TABLE "Dependent" DROP CONSTRAINT IF EXISTS "Dependent_managedByUserId_fkey";

-- Step 3: drop the indexes created in 20260704192603_bun_run_db_push.
DROP INDEX IF EXISTS "Dependent_householdId_idx";
DROP INDEX IF EXISTS "Dependent_managedByUserId_idx";
DROP INDEX IF EXISTS "Dependent_deletedAt_idx";

-- Step 4: drop the table itself.
DROP TABLE IF EXISTS "Dependent";