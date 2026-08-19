-- Block sign-in for third-party email relay aliases (e.g. Apple Private
-- Relay). The platform can no longer reliably reach these users by
-- email, so new accounts with a relay domain are refused at sign-in and
-- existing accounts are flagged in the admin UI. See
-- docs/agents/SECURITY.md for the contact-channel policy.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailIsRelay" BOOLEAN NOT NULL DEFAULT false;
