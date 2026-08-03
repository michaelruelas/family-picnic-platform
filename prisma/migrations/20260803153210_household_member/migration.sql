-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");

-- CreateIndex
CREATE INDEX "HouseholdMember_deletedAt_idx" ON "HouseholdMember"("deletedAt");

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing adult users and dependents become placeholder members.
-- Adults come from User rows with a householdId; dependents come from the Dependent table.
INSERT INTO "HouseholdMember" ("id", "householdId", "name", "age", "notes", "createdAt", "updatedAt")
SELECT
    'mem_' || "id",
    "householdId",
    COALESCE(NULLIF("name", ''), 'Member'),
    NULL,
    'Backfilled from existing household record',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "householdId" IS NOT NULL
  AND "deletedAt" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "HouseholdMember" ("id", "householdId", "name", "age", "notes", "createdAt", "updatedAt")
SELECT
    'mem_' || "id",
    "householdId",
    COALESCE(NULLIF("name", ''), 'Member'),
    "age",
    'Backfilled from existing dependent record',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Dependent"
WHERE "deletedAt" IS NULL
ON CONFLICT DO NOTHING;