-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "smsConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "smsConsentAt" TIMESTAMP(3),
  ADD COLUMN "smsConsentIp" TEXT;

-- AlterTable
ALTER TABLE "CommunicationLog"
  ADD COLUMN "toPhoneNumber" TEXT,
  ADD COLUMN "fromPhoneNumber" TEXT;

-- CreateIndex
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");