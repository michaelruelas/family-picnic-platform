-- FPP-88: server foundation for the new RSVP wizard.
--
-- 1. Add `declineMessage` to the RSVP table so the decline flow can
--    capture an optional note from the guest. Nullable so existing
--    rows stay valid; the column lives on RSVP rather than on a
--    side table because every RSVP can have at most one decline
--    note and reads happen alongside the RSVP fetch.
--
-- 2. Add `body` to CommunicationLog so the invitation send can
--    record the URL the recipient should click. Nullable for
--    historical rows that pre-date this column.
ALTER TABLE "RSVP"
  ADD COLUMN "declineMessage" TEXT;

ALTER TABLE "CommunicationLog"
  ADD COLUMN "body" TEXT;
