-- Split the legacy `ADMIN_ADULT` Role enum value into `ADMIN` and `ADULT`.
--
-- Background: FPP-65 / QUB-13 introduced `SUPER_ADMIN` (the renamed
-- pre-FPP-65 `ADMIN`) and `HOST`, leaving `ADMIN_ADULT` as the default
-- for newly signed-up users and a member of the platform-level admin
-- set. That single value conflated two distinct concepts — "user with
-- household admin tools" and "default role for new signups" — and the
-- household-admin behaviour has moved to `ADMIN`. This migration:
--
--   1. Adds `ADMIN` and `ADULT` to the Role enum. Postgres requires
--      new enum values to be added in their own transaction before the
--      column can use them, so the ADD VALUE statements run first.
--   2. Backfills every existing `ADMIN_ADULT` row to `ADMIN`. The
--      legacy value carried admin access to the user's own household;
--      `ADMIN` is the direct semantic successor. New users start as
--      `ADULT` (see the schema-level default) and only escalate to
--      `ADMIN` through an explicit promotion.
--   3. Drops the legacy `ADMIN_ADULT` enum value. Postgres cannot
--      remove a value from an enum in place, so the migration
--      recreates the type without `ADMIN_ADULT` and re-casts the
--      `User.role` column. The cast is a no-op because every row is
--      either `SUPER_ADMIN`, `ADMIN` (post-backfill), `HOST`, or the
--      schema-level default `ADULT`.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADULT';

-- Backfill: ADMIN_ADULT -> ADMIN. The legacy value carried household-
-- admin access, so ADMIN is the semantic successor. The WHERE clause
-- is explicit (rather than a blind SET) so a follow-up audit can see
-- how many rows moved.
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "role" = 'ADMIN_ADULT';

-- Recreate the Role enum without ADMIN_ADULT and re-cast the User.role
-- column. Postgres <10 needs the old type renamed out of the way so
-- the new type can take its name; we use the same `Role` identifier
-- after the rename so application code does not have to change.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ADULT', 'HOST');
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role"),
  SET DEFAULT 'ADULT';
DROP TYPE "Role_old";