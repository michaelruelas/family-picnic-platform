-- FPP-57 / QUB-19: third-party auth identities linked to a user account.
-- Each row records one (provider, providerAccountId) pair that
-- successfully signed in for a given user. Used by Apple and Facebook
-- to enable account linking: a returning user with an existing row
-- signs in directly, while a fresh email creates a row alongside
-- the user.
--
-- provider is stored as a free-form string ("google", "apple",
-- "facebook") so adding a future provider does not require a
-- Prisma migration. providerAccountId is the provider's stable
-- per-user subject id (Apple's `sub`, Facebook's `id`).

-- CreateTable
CREATE TABLE "LinkedIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "emailSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedIdentity_provider_providerAccountId_key"
  ON "LinkedIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "LinkedIdentity_userId_idx" ON "LinkedIdentity"("userId");

-- CreateIndex
CREATE INDEX "LinkedIdentity_provider_idx" ON "LinkedIdentity"("provider");

-- AddForeignKey
ALTER TABLE "LinkedIdentity"
  ADD CONSTRAINT "LinkedIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
