/*
  Warnings:

  - You are about to drop the column `archived_at` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `dietaryNotes` on the `RSVP` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Event_archived_at_date_idx";

-- DropIndex
DROP INDEX "Event_archived_at_idx";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "archived_at",
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RSVP" DROP COLUMN "dietaryNotes";

-- CreateIndex
CREATE INDEX "Event_archivedAt_idx" ON "Event"("archivedAt");

-- CreateIndex
CREATE INDEX "Event_archivedAt_date_idx" ON "Event"("archivedAt", "date");
