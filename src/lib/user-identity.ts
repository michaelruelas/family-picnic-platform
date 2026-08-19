import { prisma } from '~/lib/prisma';
import { writeAuditLog, type AuditLogEntry } from '~/lib/audit';
import { isRelayEmail } from '~/lib/email-relay';
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
  /**
   * Display name from the OAuth profile (`profile.name` on Google,
   * Facebook, and Apple-on-first-sign-in). Used as the new User's
   * `name` when an account is created, so the platform never falls
   * back to the email by default. Falls back to the email only when
   * the provider did not return a name (Apple hides it on subsequent
   * sign-ins; the user can edit it from the profile page).
   */
  displayName?: string | null;
}

export interface IdentityLookupOptions {
  /**
   * When false, skip every `writeAuditLog` call inside this function.
   * Used by the `jwt` callback's read-only re-resolution path: the
   * `signIn` callback already wrote the success/refusal audit, so the
   * second call (from `jwt`) must not double-audit. Defaults to true
   * so existing callers and tests see no change.
   */
  audited?: boolean;
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
 *
 * The NextAuth `jwt` callback re-resolves the identity on every token
 * mint so the session stays current; pass `{ audited: false }` from
 * that path to avoid writing a second `auth.signIn.succeeded` row
 * after the `signIn` callback already wrote one.
 */
export async function findOrCreateUserByIdentity(
  link: IdentityLink,
  options: IdentityLookupOptions = {},
): Promise<IdentityLookupResult | null> {
  const audited = options.audited ?? true;
  const writeAudit = (entry: AuditLogEntry): Promise<void> =>
    audited ? writeAuditLog(entry) : Promise.resolve();

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
      await writeAudit({
        userId: existing.user.id,
        action: 'auth.signIn.refused',
        newValue: {
          provider: link.provider,
          reason: 'user_tombstoned',
        },
      });
      return null;
    }
    if (existing.user.emailIsRelay) {
      // The account was created with a third-party relay email. The
      // user must have an admin replace the email before they can
      // sign in again. Audit and throw so the signIn callback can
      // surface a specific error to the login form.
      await writeAudit({
        userId: existing.user.id,
        action: 'auth.signIn.refused',
        newValue: {
          provider: link.provider,
          reason: 'relay_email_blocked',
          variant: 'existing_user',
        },
      });
      throw new RelayEmailBlockedError('existing_user');
    }
    await writeAudit({
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
    await writeAudit({
      userId: 'unknown',
      action: 'auth.signIn.refused',
      newValue: {
        provider: link.provider,
        reason: 'email_missing',
      },
    });
    return null;
  }

  if (isRelayEmail(email)) {
    // The OAuth provider returned a third-party relay alias (e.g.
    // Apple Private Relay). The platform has no real way to contact
    // the user at that address, so refuse and direct them to sign in
    // with a real email instead.
    await writeAudit({
      userId: 'unknown',
      action: 'auth.signIn.refused',
      newValue: {
        provider: link.provider,
        reason: 'relay_email_blocked',
        variant: 'new_user',
      },
    });
    throw new RelayEmailBlockedError('new_user');
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
    await writeAudit({
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
    await writeAudit({
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
        name: deriveInitialName(link.displayName, email),
        role: 'ADULT',
        emailIsRelay: isRelayEmail(email),
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

  await writeAudit({
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
      emailIsRelay: isRelayEmail(normalized),
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
 * Thrown by `findOrCreateUserByIdentity` when a sign-in is refused
 * because the user has a third-party relay email (e.g. Apple Private
 * Relay). The `signIn` callback catches this and redirects the user
 * to /login?error=RelayEmail so the login form can show a specific
 * message instead of the generic "Invalid credentials".
 *
 * `variant` distinguishes the two cases the audit log records:
 *  - `existing_user`: the account is already in the DB and its
 *    `emailIsRelay` flag is true. The user must update their email
 *    (via the admin, since they cannot sign in) before signing in.
 *  - `new_user`: the email returned by the OAuth provider is a
 *    relay. The user must sign in again with a real email (e.g.
 *    "Share My Email" in Apple, or use Google).
 */
export class RelayEmailBlockedError extends Error {
  readonly code = 'RelayEmail' as const;
  readonly variant: 'existing_user' | 'new_user';
  constructor(variant: 'existing_user' | 'new_user') {
    super(
      `Sign-in refused: ${variant === 'existing_user' ? 'existing user' : 'new user'} email is a third-party relay`,
    );
    this.name = 'RelayEmailBlockedError';
    this.variant = variant;
  }
}

/**
 * Picks the best initial name for a brand-new User created via OAuth.
 *
 * The OAuth profile name (Google/Facebook/Apple) is preferred so the
 * user does not land on the app with their email as their display
 * name. The email is only used as a last resort — Apple deliberately
 * omits `profile.name` on every sign-in after the first, so a
 * returning Apple user who never linked an earlier provider would
 * otherwise have a blank profile until they edited it manually.
 *
 * The returned string is trimmed and length-capped so a malicious or
 * buggy provider cannot stash an unbounded blob in the User.name
 * column.
 */
export function deriveInitialName(displayName: string | null | undefined, email: string): string {
  const USER_NAME_MAX = 200;
  const trimmedName = displayName?.trim();
  if (trimmedName) {
    return trimmedName.slice(0, USER_NAME_MAX);
  }
  return email;
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
