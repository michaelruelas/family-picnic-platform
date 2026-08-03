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
-- the oldest row.
DO $$
DECLARE
  grp RECORD;
  ord INTEGER;
  suffix TEXT;
BEGIN
  FOR grp IN
    SELECT LOWER(btrim(name)) AS key
      FROM "Household"
     WHERE "deletedAt" IS NULL
     GROUP BY LOWER(btrim(name))
    HAVING COUNT(*) > 1
  LOOP
    ord := 0;
    FOR grp IN
      SELECT id, name
        FROM "Household"
       WHERE "deletedAt" IS NULL
         AND LOWER(btrim(name)) = grp.key
       ORDER BY "createdAt" ASC, id ASC
      LOOP
        ord := ord + 1;
        IF ord > 1 THEN
          suffix := ' (' || ord::TEXT || ')';
          UPDATE "Household"
             SET name = substring(btrim(name) || suffix from 1 for 80)
           WHERE id = grp.id;
        END IF;
      END LOOP;
  END LOOP;
END $$;

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

