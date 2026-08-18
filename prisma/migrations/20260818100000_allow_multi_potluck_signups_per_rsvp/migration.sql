-- Allow the same (slot, RSVP) pair to have multiple PotluckSignup rows so
-- a household can bring several distinct items in the same category slot
-- (e.g. "Other: Cups" and "Other: Napkins"). Each signup is now uniquely
-- identified by its cuid `id`; the dish name is the human-readable
-- disambiguator. Capacity (`PotluckSlot.maxSignups`) still counts every
-- signup row against the slot, so a multi-claim on a LIMITED slot still
-- spends one capacity unit per dish.
DROP INDEX "PotluckSignup_slotId_rsvpId_key";