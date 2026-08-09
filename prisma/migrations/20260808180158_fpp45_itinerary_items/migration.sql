-- FPP-45 / QUB-31.1: per-event itinerary items.
--
-- Stores optional time-of-day, title, description, and a stable
-- `order` integer for drag-to-reorder. Existing events backfill
-- with zero rows; an empty itinerary just renders the empty-state
-- on the public page until the host adds items.
--
-- `time` is a wall-clock string (HH:MM:SS) without a date. The
-- event's timezone is applied at render time per the FPP-45
-- "Time displayed in event time zone" criterion.
--
-- Index on (eventId, order) gives the admin reorder query and
-- the public list query a single seek.
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "time" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItineraryItem_eventId_order_idx" ON "ItineraryItem"("eventId", "order");

ALTER TABLE "ItineraryItem"
  ADD CONSTRAINT "ItineraryItem_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
