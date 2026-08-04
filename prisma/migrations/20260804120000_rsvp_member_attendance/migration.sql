-- CreateEnum
CREATE TYPE "RsvpAttending" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "RsvpMemberAttendance" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "householdMemberId" TEXT,
    "memberNameSnapshot" TEXT NOT NULL,
    "memberAgeSnapshot" INTEGER,
    "attending" "RsvpAttending" NOT NULL DEFAULT 'YES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RsvpMemberAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RsvpMemberAttendance_rsvpId_householdMemberId_key" ON "RsvpMemberAttendance"("rsvpId", "householdMemberId");

-- CreateIndex
CREATE INDEX "RsvpMemberAttendance_rsvpId_idx" ON "RsvpMemberAttendance"("rsvpId");

-- CreateIndex
CREATE INDEX "RsvpMemberAttendance_householdMemberId_idx" ON "RsvpMemberAttendance"("householdMemberId");

-- CreateIndex
CREATE INDEX "RsvpMemberAttendance_attending_idx" ON "RsvpMemberAttendance"("attending");

-- AddForeignKey
ALTER TABLE "RsvpMemberAttendance" ADD CONSTRAINT "RsvpMemberAttendance_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpMemberAttendance" ADD CONSTRAINT "RsvpMemberAttendance_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: build attendance rows for every existing RSVP from the
-- household's member list. Members are ordered by createdAt so the
-- first N (where N = headcount for confirmed, 0 for declined) are
-- marked YES and any remainder are marked NO. If the household has
-- fewer members than headcount, all members are marked YES; rows
-- beyond the household's roster are not invented because the user
-- may have since added members that did not exist at RSVP time.
INSERT INTO "RsvpMemberAttendance" (
  "id",
  "rsvpId",
  "householdMemberId",
  "memberNameSnapshot",
  "memberAgeSnapshot",
  "attending",
  "createdAt",
  "updatedAt"
)
SELECT
  'att_' || md5(r."id" || '_' || hm."id"),
  r."id",
  hm."id",
  hm."name",
  hm."age",
  CASE
    WHEN r.status = 'DECLINED' THEN 'NO'::"RsvpAttending"
    WHEN hm.rownum <= r."headcount" THEN 'YES'::"RsvpAttending"
    ELSE 'NO'::"RsvpAttending"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "RSVP" r
JOIN "Household" h ON h."id" = r."householdId"
JOIN LATERAL (
  SELECT
    hm_inner."id",
    hm_inner."name",
    hm_inner."age",
    ROW_NUMBER() OVER (ORDER BY hm_inner."createdAt" ASC, hm_inner."id" ASC) AS rownum
  FROM "HouseholdMember" hm_inner
  WHERE hm_inner."householdId" = h."id"
    AND hm_inner."deletedAt" IS NULL
) hm ON true
ON CONFLICT ("rsvpId", "householdMemberId") DO NOTHING;
