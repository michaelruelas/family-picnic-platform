-- Add Event columns that were introduced via db:push but never captured
-- in a migration file. Without them, `prisma migrate reset` produces a
-- schema that is missing these columns, breaking the seed script and any
-- code that references them.

ALTER TABLE "Event" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "lng" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "placeId" TEXT;
ALTER TABLE "Event" ADD COLUMN "additionalInfo" TEXT;
