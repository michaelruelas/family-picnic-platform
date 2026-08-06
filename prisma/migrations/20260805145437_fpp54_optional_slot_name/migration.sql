-- FPP-54: make PotluckSlot.name optional.
--
-- Admins can create a slot in a category without pre-specifying a dish
-- (e.g. "A dessert" with no specific recipe). The specific dish lives on
-- the user's claim (PotluckSignup.dishName) and stays required there.
--
-- Existing rows are not touched; they keep whatever name they had. New
-- rows may omit the column (NULL) or send an empty string. Empty
-- strings are normalised to NULL by the application layer so the UI
-- can treat NULL as the single "no name" signal.
ALTER TABLE "PotluckSlot"
  ALTER COLUMN "name" DROP NOT NULL;
