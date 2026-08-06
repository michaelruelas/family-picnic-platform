-- FPP-88 review: add a `kind` discriminator to CommunicationLog.
--
-- FPP-88 added the `body` column to hold two semantically different
-- payloads (invitation URL, decline note). The send pipeline that
-- reads `body` cannot tell them apart, and both rows are eligible
-- to be picked up by the queue processor. The review asked for a
-- discriminator while the table is being altered anyway.
--
-- The enum default is BROADCAST so pre-FPP-88 rows and unrelated
-- broadcast writes keep working without a code change. New writes
-- from the FPP-88 paths set `kind` explicitly.
CREATE TYPE "CommunicationLogKind" AS ENUM (
  'BROADCAST',
  'INVITATION',
  'DECLINE_NOTE'
);

ALTER TABLE "CommunicationLog"
  ADD COLUMN "kind" "CommunicationLogKind" NOT NULL DEFAULT 'BROADCAST';

CREATE INDEX "CommunicationLog_kind_idx" ON "CommunicationLog"("kind");
