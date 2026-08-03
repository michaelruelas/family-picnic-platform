-- Backfill blank household names from the first user's name where available.
-- If a household has no users, falls back to "Family <id>" so the NOT NULL
-- constraint is never violated.

DO $$
DECLARE
  hh RECORD;
  fallback TEXT;
BEGIN
  FOR hh IN
    SELECT h.id, h.name
    FROM "Household" h
    WHERE h.name IS NULL OR btrim(h.name) = ''
  LOOP
    SELECT u.name
      INTO fallback
      FROM "User" u
     WHERE u."householdId" = hh.id
       AND u."deletedAt" IS NULL
     ORDER BY u."createdAt" ASC
     LIMIT 1;

    IF fallback IS NOT NULL AND btrim(fallback) <> '' THEN
      UPDATE "Household"
         SET name = btrim(fallback) || ' Household'
       WHERE id = hh.id;
    ELSE
      UPDATE "Household"
         SET name = 'Family ' || substring(hh.id from 1 for 8)
       WHERE id = hh.id;
    END IF;
  END LOOP;
END $$;

-- Before the unique index can be created, collapse any case-only
-- duplicates that already exist by appending a discriminator to all but
-- the oldest row. The oldest row in each duplicate group keeps its name;
-- subsequent rows are suffixed with " (2)", " (3)", and so on. The name
-- is truncated to 80 characters so the eventual CHECK constraint stays
-- satisfied.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(btrim(name))
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn,
         COUNT(*) OVER (
           PARTITION BY LOWER(btrim(name))
         ) AS cnt
    FROM "Household"
   WHERE "deletedAt" IS NULL
)
UPDATE "Household" h
   SET name = substring(btrim(h.name) || ' (' || r.rn::TEXT || ')' FROM 1 FOR 80)
  FROM ranked r
 WHERE h.id = r.id
   AND r.cnt > 1
   AND r.rn > 1;

-- Enforce 1..80 character household names at the database layer so future
-- writes cannot bypass application validation.
ALTER TABLE "Household"
  ADD CONSTRAINT "household_name_length_check"
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 80);

-- Enforce case-insensitive uniqueness across active households so
-- concurrent writers cannot race past the application pre-check. Soft-
-- deleted rows are excluded so re-using a name later is still possible.
CREATE UNIQUE INDEX "household_name_unique_active_idx"
  ON "Household" (LOWER(btrim(name)))
  WHERE "deletedAt" IS NULL;

