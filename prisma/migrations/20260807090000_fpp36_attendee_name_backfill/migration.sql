-- FPP-36: backfill Guest N placeholders for RSVPs whose
-- existing attendance rows do not cover the full headcount.
--
-- Why: the original 20260804120000_rsvp_member_attendance
-- migration built attendance rows from the household roster only.
-- RSVPs whose headcount exceeded the live roster at migration time
-- were left under-counted (the missing slots never got a row).
-- Per the FPP-36 notes, those missing slots get a "Guest N"
-- placeholder so every adult / child slot has a name.
--
-- The placeholder rows are ad-hoc (householdMemberId = NULL,
-- memberAgeSnapshot = NULL). They are flagged NO when the RSVP
-- itself is DECLINED so a declined RSVP does not show fake
-- "going" guests. Everything else defaults to YES so the missing
-- slots count toward capacity, matching the pre-FPP-36 behaviour
-- where the unrendered slots were implicitly "going".
--
-- Idempotency: the WITH-slot-counts CTE bounds generate_series by
-- GREATEST(headcount - existing_rows, 0). Re-running the migration
-- once the placeholders are in place produces a zero-width series
-- and inserts nothing. There is no ON CONFLICT clause because the
-- (rsvpId, householdMemberId) unique index treats NULLs as
-- distinct in Postgres by default, so ad-hoc rows can never
-- collide on that index anyway.
WITH slot_counts AS (
  SELECT
    r."id" AS "rsvpId",
    r."status",
    r."headcount",
    COUNT(rma."id") AS "existingRows"
  FROM "RSVP" r
  LEFT JOIN "RsvpMemberAttendance" rma ON rma."rsvpId" = r."id"
  GROUP BY r."id", r."status", r."headcount"
),
missing_slots AS (
  SELECT
    sc."rsvpId",
    sc."status",
    generate_series(1, GREATEST(sc."headcount" - sc."existingRows", 0)) AS "slot"
  FROM slot_counts sc
)
INSERT INTO "RsvpMemberAttendance" (
  "id",
  "rsvpId",
  "householdMemberId",
  "memberNameSnapshot",
  "memberAgeSnapshot",
  "attending",
  "createdAt",
  "updatedAt"
)
SELECT
  'att_guest_' || md5(ms."rsvpId" || '_' || ms."slot"),
  ms."rsvpId",
  NULL,
  'Guest ' || ms."slot",
  NULL,
  CASE WHEN ms."status" = 'DECLINED' THEN 'NO'::"RsvpAttending" ELSE 'YES'::"RsvpAttending" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM missing_slots ms;
