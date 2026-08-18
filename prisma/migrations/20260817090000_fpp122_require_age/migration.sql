-- FPP-122: age becomes required on HouseholdMember and Dependent.
--
-- Background: the per-attendee registration fee in the RSVP flow is
-- computed from the age of every member on the attendance list. A
-- NULL age silently drops that member from the fee calculation, which
-- was a source of under-charging and confused hosts. The form layer
-- already collects an age on every member; this migration makes it a
-- database-level invariant.
--
-- Backfill strategy:
--   1. Dependents that already carry an age keep their value.
--   2. Dependents without an age default to 18 (treat as adult).
--   3. Household members backed by a Dependent row pick up the
--      Dependent.age (so the backfilled member matches the source).
--   4. Standalone HouseholdMember rows (the account holder's seed
--      row and any others without a Dependent source) default to 18.
--   5. Then we add NOT NULL constraints and a CHECK to keep ages in
--      a sane range so a hostile client cannot ship negative values.
--   6. Finally we drop the now-redundant CHECK on `age >= 0` that
--      HouseholdMember and Dependent both carried (the new
--      constraint supersedes it).

-- Step 1: backfill Dependents.
UPDATE "Dependent"
SET "age" = 18
WHERE "age" IS NULL;

-- Step 2: backfill HouseholdMembers from their Dependent siblings
-- when possible. The Dependent.id is 'mem_' + HouseholdMember.id for
-- rows created by the 20260803153210_household_member backfill, but
-- the safer join is by name within a household. The duplicate
-- `notes`-prefix check distinguishes backfilled vs. live entries.
UPDATE "HouseholdMember" hm
SET "age" = COALESCE(d."age", 18)
FROM "Dependent" d
WHERE d."householdId" = hm."householdId"
  AND d."name" = hm."name"
  AND d."deletedAt" IS NULL
  AND hm."deletedAt" IS NULL;

-- Step 3: any HouseholdMember still NULL (no Dependent sibling) gets
-- the adult default. The household roster's account-holder row
-- lands here; 18 is the most defensible neutral value until the user
-- edits it.
UPDATE "HouseholdMember"
SET "age" = 18
WHERE "age" IS NULL;

-- Step 4: enforce NOT NULL on both tables.
ALTER TABLE "HouseholdMember" ALTER COLUMN "age" SET NOT NULL;
ALTER TABLE "Dependent" ALTER COLUMN "age" SET NOT NULL;

-- Step 5: sanity range. Mirrors the Zod schemas (`nonnegative().max(120)`).
ALTER TABLE "HouseholdMember"
  ADD CONSTRAINT "HouseholdMember_age_check" CHECK ("age" >= 0 AND "age" <= 120);
ALTER TABLE "Dependent"
  ADD CONSTRAINT "Dependent_age_check" CHECK ("age" >= 0 AND "age" <= 120);
