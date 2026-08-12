-- FPP-68 / QUB-12: `archived_at` flag on the events table.
--
-- Distinct from `status` (DRAFT / PUBLISHED / CLOSED / CANCELLED):
-- archiving is orthogonal to the lifecycle so a host can retire an
-- event from the active admin list without touching its status.
-- FPP-70 reopen and the existing close/publish/cancel flows are
-- unaffected by this column.
--
-- Backfill: every pre-FPP-68 row leaves `archived_at` NULL. The
-- admin "Past events" view will surface both `archived_at IS NOT
-- NULL` rows AND rows whose `date < now` so legacy events are
-- still discoverable without a destructive backfill. See FPP-68
-- acceptance criteria.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_archived_at_idx" ON "Event"("archived_at");

-- FPP-68 / QUB-12: composite (archived_at, date) index covers the
-- past-events view's `WHERE (archived_at IS NOT NULL OR (archived_at
-- IS NULL AND date < now)) ORDER BY date DESC` so Postgres can
-- filter and sort from a single index without a separate sort step.
CREATE INDEX "Event_archived_at_date_idx" ON "Event"("archived_at", "date");