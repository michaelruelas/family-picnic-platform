-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FORFEITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM (
  'REQUIRES_PAYMENT_METHOD',
  'REQUIRES_CONFIRMATION',
  'REQUIRES_ACTION',
  'PROCESSING',
  'REQUIRES_CAPTURE',
  'SUCCEEDED',
  'CANCELED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "registrationFeeCents" INTEGER DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd';

-- CreateTable: Registration
CREATE TABLE "Registration" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "householdId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "refundedCents" INTEGER NOT NULL DEFAULT 0,
  "receiptSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Charge
CREATE TABLE "Charge" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "stripePaymentIntentId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "ChargeStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT_METHOD',
  "receiptUrl" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Refund
CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "chargeId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "stripeRefundId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "refundedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Registration — drop the receiptSentAt column that we
-- decided belongs on Charge, not Registration.
ALTER TABLE "Registration" DROP COLUMN "receiptSentAt";

-- AlterTable: Charge — add the receiptSentAt column. Set when the
-- receipt email goes out; the webhook and the admin "resend receipt"
-- action both check this to avoid re-mailing on retries.
ALTER TABLE "Charge" ADD COLUMN "receiptSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_userId_key" ON "Registration"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");

-- CreateIndex
CREATE INDEX "Registration_userId_idx" ON "Registration"("userId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_stripePaymentIntentId_key" ON "Charge"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Charge_registrationId_idx" ON "Charge"("registrationId");

-- CreateIndex
CREATE INDEX "Charge_status_idx" ON "Charge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_chargeId_idx" ON "Refund"("chargeId");

-- CreateIndex
CREATE INDEX "Refund_registrationId_idx" ON "Refund"("registrationId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_refundedByUserId_idx" ON "Refund"("refundedByUserId");

-- AddForeignKey: Registration -> Event
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Registration -> User
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Charge -> Registration
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Refund -> Charge
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Refund -> Registration
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Refund -> User (issuer)
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_refundedByUserId_fkey" FOREIGN KEY ("refundedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
