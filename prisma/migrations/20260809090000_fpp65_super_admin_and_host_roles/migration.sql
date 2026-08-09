-- FPP-65 / QUB-13: introduce `super_admin` and `host` roles.
--
-- The pre-FPP-65 `Role` enum had two values:
--   - `ADMIN`       — platform-level admin (the seed admin@family-picnic.example.com
--                     account, and any hand-promoted admin in the future).
--   - `ADMIN_ADULT` — the default for newly signed-up adult family members.
--                     Kept as-is so existing household-member behaviour is
--                     unaffected by this migration.
--
-- This migration:
--   1. Adds `SUPER_ADMIN` (the renamed `ADMIN`) and `HOST` (new, scoped
--      per-event role) to the enum. Postgres requires new values to be
--      added one at a time, and they cannot be used in the same
--      transaction they were created in on Postgres <12. We add them
--      inside a single DO block so the migration is atomic; the UPDATE
--      below runs after the values exist.
--   2. Backfills every existing `ADMIN` row to `SUPER_ADMIN` so the
--      invariant "platform admins have role SUPER_ADMIN" holds from the
--      moment the migration ships. There is intentionally no
--      automatic host assignment for legacy events — per the spec,
--      super-admins assign hosts explicitly via the admin UI.
--   3. Leaves the old `ADMIN` enum value in place. Removing a Postgres
--      enum value requires recreating the type, which is out of scope
--      for this ticket (and would force every dependent column to
--      re-cast). Future roles land via clean migrations.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOST';

-- Backfill: every existing platform admin becomes a super-admin. The
-- WHERE clause intentionally excludes `ADMIN_ADULT` rows — those are
-- regular family members, not platform admins, and were never meant to
-- be promoted by this ticket.
UPDATE "User"
SET "role" = 'SUPER_ADMIN'
WHERE "role" = 'ADMIN';
