-- FPP-101: wire deliverOne to SendGrid (email half).
--
-- 1. Add `SKIPPED` to CommunicationStatus so the worker can record
--    rows that opted out (NONE preference, missing email) without
--    the operator confusing them with FAILED. The retry script
--    targets FAILED only; SKIPPED is terminal.
--
-- 2. Add `retryCount` to CommunicationLog so the retry-failed-comms
--    script can track how many times an operator has re-queued a
--    give-up row. Default 0; bumped on every retry. The column is
--    nullable=false with a default so existing rows pick up 0
--    automatically without a backfill.
ALTER TYPE "CommunicationStatus" ADD VALUE 'SKIPPED';

ALTER TABLE "CommunicationLog"
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
