-- Add the optional `relationship` column to HouseholdMember so the
-- onboarding family step can persist the user's picker choice
-- (SPOUSE / CHILD / PARENT / ...) instead of dropping it on the
-- floor. The column is optional to keep the migration safe for
-- existing rows and to match the UX of a free-text family tree.
-- QUB-21 removed dietary fields; relationship is a separate axis
-- and stays in scope.

ALTER TABLE "HouseholdMember"
  ADD COLUMN "relationship" TEXT;
