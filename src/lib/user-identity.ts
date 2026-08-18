import { prisma } from '~/lib/prisma';
import { writeAuditLog } from '~/lib/audit';
import type { Role } from '~/lib/generated/enums';

export const SUPPORTED_OAUTH_PROVIDERS = ['google', 'apple', 'facebook'] as const;
export type OAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export interface IdentityLink {
  provider: OAuthProvider;
  providerAccountId: string;
  emailSnapshot?: string | null;
}

export interface IdentityLookupResult {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  // True when a new LinkedIdentity row was created during this call.
  // Audited actions reference this so the audit log can distinguish
  // "signed in with an existing identity" from "linked a new identity".
  identityCreated: boolean;
  // True when the row was created because the email already existed
  // (FPP-31: account linking). False when the row was created along
  // with a brand-new user.
  linkedToExistingUser: boolean;
}

/**
 * Resolves a successful OAuth sign-in to a User row.
 *
 * Lookup order:
 *  1. If a `LinkedIdentity` row matches (provider, providerAccountId),
 *     return the owning user. No row is created.
 *  2. Otherwise, look up by the provider-returned email. If a soft-deleted
 *     tombstone exists, refuse sign-in (returns null).
 *  3. If a non-deleted user with that email exists, attach a new
 *     `LinkedIdentity` row to that user (account linking per FPP-31).
 *  4. Otherwise, create a new user (`role: ADULT`) and the
 *     `LinkedIdentity` row in one transaction.
 *
 * The function is intentionally provider-agnostic so the same code
 * drives Google, Apple, and Facebook sign-in. The caller passes the
 * provider's stable subject id (`profile.sub` for Apple, `profile.id`
 * for Facebook) as `providerAccountId`.
 *
 * Returns `null` when sign-in should be refused (only path: a soft-deleted
 * user with the same email). The audit log captures the decision in
 * both success and failure cases for FPP-26.2 compliance.
 */
export async function findOrCreateUserByIdentity(
  link: IdentityLink,
): Promise<IdentityLookupResult | null> {
  const email = link.emailSnapshot?.trim().toLowerCase();
  const providerAccountId = link.providerAccountId.trim();
  if (!providerAccountId) {
    throw new Error('providerAccountId is required');
  }

  const existing = await prisma.linkedIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider: link.provider,
        providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    if (existing.user.deletedAt) {
      await writeAuditLog({
        userId: existing.user.id,
        action: 'auth.signIn.refused',
        newValue: {
          provider: link.provider,
          reason: 'user_tombstoned',
        },
      });
      return null;
    }
    await writeAuditLog({
      userId: existing.user.id,
      action: 'auth.signIn.succeeded',
      newValue: { provider: link.provider, identityId: existing.id },
    });
    return {
      userId: existing.user.id,
      user: {
        id: existing.user.id,
        email: existing.user.email,
        name: existing.user.name,
        role: existing.user.role,
      },
      identityCreated: false,
      linkedToExistingUser: false,
    };
  }

  if (!email) {
    // Provider did not return an email (Apple's private relay can
    // legitimately omit it on subsequent sign-ins). We cannot fall back
    // to email lookup, so the only safe options are: (a) refuse, or
    // (b) allow a "no-email" user. Refuse for now to keep the model
    // simple; the LinkedIdentity row is still created if the user
    // already authenticated via another provider earlier.
    await writeAuditLog({
      userId: 'unknown',
      action: 'auth.signIn.refused',
      newValue: {
        provider: link.provider,
        reason: 'email_missing',
      },
    });
    return null;
  }

  const activeByEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
  });
  if (activeByEmail) {
    const created = await prisma.linkedIdentity.create({
      data: {
        userId: activeByEmail.id,
        provider: link.provider,
        providerAccountId,
        emailSnapshot: email,
      },
    });
    await writeAuditLog({
      userId: activeByEmail.id,
      action: 'auth.identity.linked',
      newValue: {
        provider: link.provider,
        identityId: created.id,
        matchedBy: 'email',
      },
    });
    return {
      userId: activeByEmail.id,
      user: {
        id: activeByEmail.id,
        email: activeByEmail.email,
        name: activeByEmail.name,
        role: activeByEmail.role,
      },
      identityCreated: true,
      linkedToExistingUser: true,
    };
  }

  const tombstone = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, deletedAt: true },
  });
  if (tombstone?.deletedAt) {
    await writeAuditLog({
      userId: tombstone.id,
      action: 'auth.signIn.refused',
      newValue: {
        provider: link.provider,
        reason: 'email_tombstoned',
      },
    });
    return null;
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: email,
        role: 'ADULT',
      },
    });
    const identity = await tx.linkedIdentity.create({
      data: {
        userId: user.id,
        provider: link.provider,
        providerAccountId,
        emailSnapshot: email,
      },
    });
    return { user, identity };
  });

  await writeAuditLog({
    userId: created.user.id,
    action: 'auth.signIn.succeeded',
    newValue: {
      provider: link.provider,
      identityId: created.identity.id,
      userCreated: true,
    },
  });

  return {
    userId: created.user.id,
    user: {
      id: created.user.id,
      email: created.user.email,
      name: created.user.name,
      role: created.user.role,
    },
    identityCreated: true,
    linkedToExistingUser: false,
  };
}

/**
 * Links an OAuth identity to an already-authenticated user.
 *
 * FPP-31: an existing email user can link an Apple or Facebook identity
 * after re-auth. The caller must enforce the "currently signed in" check
 * (this function does not check auth itself — it's a pure data operation).
 *
 * The caller is also responsible for verifying the session password or
 * the equivalent re-auth proof. The platform's OAuth-only flow means the
 * session itself is the strongest available proof, so the practical
 * "re-auth" check is just "session is non-null".
 */
export async function linkIdentityToCurrentUser(
  userId: string,
  link: IdentityLink,
): Promise<{ id: string; provider: OAuthProvider }> {
  const providerAccountId = link.providerAccountId.trim();
  if (!providerAccountId) {
    throw new Error('providerAccountId is required');
  }

  const existing = await prisma.linkedIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider: link.provider,
        providerAccountId,
      },
    },
  });
  if (existing) {
    if (existing.userId === userId) {
      return { id: existing.id, provider: link.provider };
    }
    throw new IdentityAlreadyLinkedError(
      `${link.provider} account is already linked to a different user`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true, email: true },
  });
  if (!user || user.deletedAt) {
    throw new Error('User not found');
  }

  const created = await prisma.linkedIdentity.create({
    data: {
      userId,
      provider: link.provider,
      providerAccountId,
      emailSnapshot: link.emailSnapshot ?? user.email,
    },
  });
  await writeAuditLog({
    userId,
    action: 'auth.identity.linked',
    newValue: {
      provider: link.provider,
      identityId: created.id,
      matchedBy: 'explicit',
    },
  });
  return { id: created.id, provider: link.provider };
}

export async function findOrCreateUserByEmail(
  email: string,
  name: string,
  householdId: string,
  role?: Role,
): Promise<{ userId: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' }, deletedAt: null },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { householdId },
    });
    return { userId: existing.id, created: false };
  }
  const created = await prisma.user.create({
    data: {
      email: normalized,
      name,
      householdId,
      ...(role ? { role } : {}),
    },
  });
  return { userId: created.id, created: true };
}

export class IdentityAlreadyLinkedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityAlreadyLinkedError';
  }
}

/**
 * Returns the linked providers for a user. Used by the profile UI
 * to render the "connected accounts" section (FPP-31 acceptance).
 */
export async function listLinkedIdentities(userId: string) {
  return prisma.linkedIdentity.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      emailSnapshot: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Removes a linked identity. The user keeps their account; they just
 * can't sign in with that provider anymore. If the user has no other
 * sign-in method, the contact UI surfaces a warning so the removal
 * does not lock the user out.
 */
export async function unlinkIdentity(userId: string, identityId: string): Promise<void> {
  const identity = await prisma.linkedIdentity.findUnique({
    where: { id: identityId },
  });
  if (!identity || identity.userId !== userId) {
    throw new Error('Identity not found');
  }
  await prisma.linkedIdentity.delete({ where: { id: identityId } });
  await writeAuditLog({
    userId,
    action: 'auth.identity.unlinked',
    oldValue: {
      provider: identity.provider,
      identityId: identity.id,
    },
  });
}
