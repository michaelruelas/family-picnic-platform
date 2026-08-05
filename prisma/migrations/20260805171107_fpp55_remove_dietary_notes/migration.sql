-- FPP-55: remove the RSVP.dietaryNotes field from the application.
--
-- The column is intentionally left in the database so historical values
-- remain queryable for audit. The application no longer reads or writes
-- this field (Prisma no longer exposes it), and the UI no longer surfaces
-- it. Drop the column in a future sweep after the audit window expires.
--
-- The removal is recorded here in the AdminAuditLog so the change is
-- traceable (QUB-26.2). The INSERT is idempotent: if the audit row is
-- already present (e.g. the migration was partially replayed) the
-- statement inserts nothing.

INSERT INTO "AdminAuditLog" (
  "id",
  "userId",
  "eventId",
  "action",
  "oldValue",
  "newValue",
  "createdAt"
)
SELECT
  'audit_fpp55_dietary_notes_removed',
  u.id,
  NULL,
  'FPP55_DIETARY_NOTES_REMOVED',
  jsonb_build_object(
    'field',
    'dietaryNotes',
    'model',
    'RSVP',
    'reason',
    'Removed per FPP-55; historical values preserved in DB for audit (QUB-26.2)'
  ),
  NULL,
  CURRENT_TIMESTAMP
FROM (
  SELECT "id"
  FROM "User"
  WHERE "role" = 'ADMIN'
  ORDER BY "createdAt" ASC
  LIMIT 1
) AS u
WHERE NOT EXISTS (
  SELECT 1
  FROM "AdminAuditLog"
  WHERE "action" = 'FPP55_DIETARY_NOTES_REMOVED'
);
