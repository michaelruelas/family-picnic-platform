-- FPP-43 / QUB-33: per-event PDF attachments.
--
-- One row per file. Bytes live in the S3-compatible bucket under
-- `events/{eventId}/attachments/{userId}/{timestamp}-{filename}` and
-- `key` is the canonical reference; `filename` is the human label the
-- host typed at upload time and what guests see on the public page.
--
-- `contentType` is captured at upload so a future content-type swap
-- cannot change what guests download. `sizeBytes` lets the public
-- page render a human-readable size without re-reading the object.
-- `virusScanStatus` is PENDING on create; for the first ship the
-- row-create path immediately moves new rows to SKIPPED so downloads
-- are not blocked behind an unfinished scan worker.
CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED', 'FAILED');

CREATE TABLE "EventAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "virusScanStatus" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAttachment_pkey" PRIMARY KEY ("id")
);

-- `key` is unique so two rows cannot claim the same S3 object.
CREATE UNIQUE INDEX "EventAttachment_key_key" ON "EventAttachment"("key");

-- Indexes for the three access patterns we expect:
--   1. Public event page: list attachments for an event, ordered
--      by createdAt desc. `(eventId)` is enough; the page-level
--      query adds `orderBy: { createdAt: 'desc' }`.
--   2. Admin "my uploads" report: list attachments by uploader.
--   3. Future scan worker: scan pending rows by status.
CREATE INDEX "EventAttachment_eventId_idx" ON "EventAttachment"("eventId");
CREATE INDEX "EventAttachment_uploadedByUserId_idx" ON "EventAttachment"("uploadedByUserId");
CREATE INDEX "EventAttachment_virusScanStatus_idx" ON "EventAttachment"("virusScanStatus");

ALTER TABLE "EventAttachment"
  ADD CONSTRAINT "EventAttachment_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "EventAttachment"
  ADD CONSTRAINT "EventAttachment_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
