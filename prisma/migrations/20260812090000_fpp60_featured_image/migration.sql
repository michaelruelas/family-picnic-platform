-- FPP-60: per-event featured hero image.
--
-- The event page hero currently falls back to `Event.mapImageUrl`
-- (the static map preview) and then to a gradient. Hosts can now
-- override that with a real photo they upload through the admin
-- event form. The column is nullable; existing events backfill to
-- NULL so the legacy map fallback keeps rendering for every event
-- the host hasn't touched yet.
--
-- No index is added — admin event queries filter by id/date, and
-- the public event page reads a single row by id, so a per-row
-- column is sufficient.

ALTER TABLE "Event"
  ADD COLUMN "featuredImageUrl" TEXT;
