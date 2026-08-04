-- Per-event minimum-age threshold for the registration fee. An attendee
-- with `memberAgeSnapshot >= registrationFeeMinAge` counts toward the
-- per-attendee fee total; everyone below the threshold is free. Default
-- 0 matches the pre-FPP-48 behavior where every attendee paid the
-- flat `registrationFeeCents`. Rows that pre-date this migration get
-- the default via the column default; existing `Registration.amountCents`
-- snapshots are NOT recomputed (per ticket: "no charge applied
-- retroactively"). The `backfill-registration-fees` script covers any
-- future rows that should be explicitly pinned to 0 for audit trail.
ALTER TABLE "Event"
  ADD COLUMN "registrationFeeMinAge" INTEGER NOT NULL DEFAULT 0;
