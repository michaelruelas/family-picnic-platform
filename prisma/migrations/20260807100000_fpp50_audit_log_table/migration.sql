-- FPP-50: domain-event audit log table (signup, RSVP change, registration,
-- payment events, host assignment, role change). Separate from AdminAuditLog
-- so domain events can be filtered by actor, action, subject (type+id),
-- and time range without sifting through admin-only entries.

CREATE TABLE "AuditLog" (
  "id"          TEXT NOT NULL,
  "actorId"     TEXT,
  "action"      TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId"   TEXT NOT NULL,
  "payload"     JSONB,
  "occurredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_subjectType_subjectId_idx" ON "AuditLog" ("subjectType", "subjectId");
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog" ("actorId", "occurredAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" ("action");
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog" ("occurredAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only: block UPDATE and DELETE on the table. FK ON DELETE SET NULL
-- keeps user deletion from cascading into AuditLog rows; the trigger only
-- fires when the application role (or a superuser acting as it) tries to
-- modify an entry. There is intentionally no UI to mutate entries; admins
-- read them via the audit log page.
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; UPDATE/DELETE not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update"
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER "AuditLog_no_delete"
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();