-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN_ADULT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CommunicationPreference" AS ENUM ('EMAIL', 'SMS', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'INLAW', 'COUSIN');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('INVITED', 'PENDING', 'CONFIRMED', 'DECLINED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "PotluckCategory" AS ENUM ('MAIN', 'SIDE', 'DESSERT', 'DRINK', 'OTHER');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('LIMITED', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('OWNER', 'COADMIN', 'INVITER');

-- CreateEnum
CREATE TYPE "ScheduledBroadcastStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentHouseholdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN_ADULT',
    "householdId" TEXT,
    "communicationPreference" "CommunicationPreference" NOT NULL DEFAULT 'EMAIL',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "devPassword" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" "Relationship" NOT NULL,
    "age" INTEGER,
    "dietaryLabels" TEXT[],
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "householdId" TEXT NOT NULL,
    "managedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "mapImageUrl" TEXT,
    "description" TEXT NOT NULL,
    "rsvpDeadline" TIMESTAMP(3),
    "maxCapacity" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "status" "RSVPStatus" NOT NULL DEFAULT 'INVITED',
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "dietaryNotes" TEXT,
    "respondedAt" TIMESTAMP(3),
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "waitlistPosition" INTEGER,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotluckSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "PotluckCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "slotType" "SlotType" NOT NULL,
    "maxSignups" INTEGER,
    "currentSignups" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PotluckSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotluckSignup" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "dishName" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "dietaryLabels" TEXT[],
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PotluckSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "messageId" TEXT,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "photoPrismId" TEXT NOT NULL,
    "caption" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoReaction" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledBroadcast" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientIds" JSONB,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledBroadcastStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAdmin" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminPermission" NOT NULL DEFAULT 'COADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Household_parentHouseholdId_idx" ON "Household"("parentHouseholdId");

-- CreateIndex
CREATE INDEX "Household_deletedAt_idx" ON "Household"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_householdId_idx" ON "User"("householdId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Dependent_householdId_idx" ON "Dependent"("householdId");

-- CreateIndex
CREATE INDEX "Dependent_managedByUserId_idx" ON "Dependent"("managedByUserId");

-- CreateIndex
CREATE INDEX "Dependent_deletedAt_idx" ON "Dependent"("deletedAt");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Event_rsvpDeadline_idx" ON "Event"("rsvpDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_eventId_idx" ON "Invitation"("eventId");

-- CreateIndex
CREATE INDEX "Invitation_userId_idx" ON "Invitation"("userId");

-- CreateIndex
CREATE INDEX "Invitation_householdId_idx" ON "Invitation"("householdId");

-- CreateIndex
CREATE INDEX "Invitation_invitedByUserId_idx" ON "Invitation"("invitedByUserId");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_eventId_userId_key" ON "Invitation"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_eventId_householdId_key" ON "Invitation"("eventId", "householdId");

-- CreateIndex
CREATE INDEX "RSVP_eventId_idx" ON "RSVP"("eventId");

-- CreateIndex
CREATE INDEX "RSVP_userId_idx" ON "RSVP"("userId");

-- CreateIndex
CREATE INDEX "RSVP_householdId_idx" ON "RSVP"("householdId");

-- CreateIndex
CREATE INDEX "RSVP_status_idx" ON "RSVP"("status");

-- CreateIndex
CREATE INDEX "RSVP_waitlistPosition_idx" ON "RSVP"("waitlistPosition");

-- CreateIndex
CREATE UNIQUE INDEX "RSVP_eventId_userId_key" ON "RSVP"("eventId", "userId");

-- CreateIndex
CREATE INDEX "PotluckSlot_eventId_idx" ON "PotluckSlot"("eventId");

-- CreateIndex
CREATE INDEX "PotluckSlot_category_idx" ON "PotluckSlot"("category");

-- CreateIndex
CREATE INDEX "PotluckSignup_slotId_idx" ON "PotluckSignup"("slotId");

-- CreateIndex
CREATE INDEX "PotluckSignup_rsvpId_idx" ON "PotluckSignup"("rsvpId");

-- CreateIndex
CREATE UNIQUE INDEX "PotluckSignup_slotId_rsvpId_key" ON "PotluckSignup"("slotId", "rsvpId");

-- CreateIndex
CREATE INDEX "CommunicationLog_eventId_idx" ON "CommunicationLog"("eventId");

-- CreateIndex
CREATE INDEX "CommunicationLog_recipientUserId_idx" ON "CommunicationLog"("recipientUserId");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_idx" ON "CommunicationLog"("status");

-- CreateIndex
CREATE INDEX "CommunicationLog_sentByUserId_idx" ON "CommunicationLog"("sentByUserId");

-- CreateIndex
CREATE INDEX "Photo_eventId_idx" ON "Photo"("eventId");

-- CreateIndex
CREATE INDEX "Photo_uploadedByUserId_idx" ON "Photo"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "Photo_householdId_idx" ON "Photo"("householdId");

-- CreateIndex
CREATE INDEX "Photo_photoPrismId_idx" ON "Photo"("photoPrismId");

-- CreateIndex
CREATE INDEX "Photo_deletedAt_idx" ON "Photo"("deletedAt");

-- CreateIndex
CREATE INDEX "PhotoReaction_photoId_idx" ON "PhotoReaction"("photoId");

-- CreateIndex
CREATE INDEX "PhotoReaction_userId_idx" ON "PhotoReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoReaction_photoId_userId_reaction_key" ON "PhotoReaction"("photoId", "userId", "reaction");

-- CreateIndex
CREATE INDEX "AdminAuditLog_userId_idx" ON "AdminAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_eventId_idx" ON "AdminAuditLog"("eventId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "ScheduledBroadcast_eventId_idx" ON "ScheduledBroadcast"("eventId");

-- CreateIndex
CREATE INDEX "ScheduledBroadcast_sentByUserId_idx" ON "ScheduledBroadcast"("sentByUserId");

-- CreateIndex
CREATE INDEX "ScheduledBroadcast_status_idx" ON "ScheduledBroadcast"("status");

-- CreateIndex
CREATE INDEX "ScheduledBroadcast_scheduledAt_idx" ON "ScheduledBroadcast"("scheduledAt");

-- CreateIndex
CREATE INDEX "EventAdmin_eventId_idx" ON "EventAdmin"("eventId");

-- CreateIndex
CREATE INDEX "EventAdmin_userId_idx" ON "EventAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAdmin_eventId_userId_key" ON "EventAdmin"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_parentHouseholdId_fkey" FOREIGN KEY ("parentHouseholdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_managedByUserId_fkey" FOREIGN KEY ("managedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotluckSlot" ADD CONSTRAINT "PotluckSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotluckSignup" ADD CONSTRAINT "PotluckSignup_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PotluckSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotluckSignup" ADD CONSTRAINT "PotluckSignup_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoReaction" ADD CONSTRAINT "PhotoReaction_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoReaction" ADD CONSTRAINT "PhotoReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBroadcast" ADD CONSTRAINT "ScheduledBroadcast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBroadcast" ADD CONSTRAINT "ScheduledBroadcast_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAdmin" ADD CONSTRAINT "EventAdmin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAdmin" ADD CONSTRAINT "EventAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
