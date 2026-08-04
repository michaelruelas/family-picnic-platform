-- One-shot backfill: prior soft-deletes left attendance rows
-- pointing at soft-deleted HouseholdMembers. The new soft-delete
-- path detaches them in the same transaction, but rows created
-- before that change would otherwise be deleted on the next RSVP
-- edit (the form replaces the entire set). This migration detaches
-- any pre-existing attendance row whose member is soft-deleted so
-- the snapshot survives future edits.

UPDATE "RsvpMemberAttendance" rma
SET "householdMemberId" = NULL
FROM "HouseholdMember" hm
WHERE rma."householdMemberId" = hm."id"
  AND hm."deletedAt" IS NOT NULL;
