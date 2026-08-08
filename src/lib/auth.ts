import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import type { Role } from './generated/enums';
import { findOrCreateUserByIdentity, isOAuthProvider, type OAuthProvider } from './user-identity';
import { buildAppleClientSecret, readAppleClientSecretConfig } from './apple-client-secret';

export const ADMIN_ROLES: readonly Role[] = ['ADMIN', 'ADMIN_ADULT'] as const;

export function isAdminRole(role: Role | null | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role as string);
}

/**
 * Looks up the Family Picnic user id for an OAuth sign-in. The
 * signIn callback (and the jwt callback fallback) calls this so the
 * resolved user id is stamped on the JWT.
 */
export async function resolveIdentityToUserId(
  provider: OAuthProvider,
  providerAccountId: string,
  email: string | null,
): Promise<string | null> {
  const resolved = await findOrCreateUserByIdentity({
    provider,
    providerAccountId,
    emailSnapshot: email,
  });
  return resolved?.userId ?? null;
}

function devCredentialsProvider() {
  const adminUsername = process.env.DEV_AUTH_USERNAME;
  const adminPassword = process.env.DEV_AUTH_PASSWORD;

  return CredentialsProvider({
    id: 'dev-credentials',
    name: 'Dev Credentials',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (process.env.DEV_AUTH_ENABLED !== 'true') {
        return null;
      }

      if (!credentials?.username || !credentials?.password) {
        return null;
      }

      if (
        adminUsername &&
        adminPassword &&
        credentials.username === adminUsername &&
        credentials.password === adminPassword
      ) {
        const devEmail = 'dev-admin@family-picnic.local';
        let user = await prisma.user.findUnique({ where: { email: devEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: devEmail,
              name: adminUsername,
              role: 'ADMIN',
            },
          });
        }
        return { id: user.id, email: user.email, name: user.name };
      }

      const user = await prisma.user.findFirst({
        where: {
          email: credentials.username,
          devPassword: credentials.password,
          deletedAt: null,
        },
      });

      if (user) {
        return { id: user.id, email: user.email, name: user.name };
      }

      return null;
    },
  });
}

const APPLE_CONFIG = readAppleClientSecretConfig();
let cachedAppleClientSecret: string | null = null;
let appleRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function refreshAppleClientSecret(): Promise<string | null> {
  if (!APPLE_CONFIG) return null;
  try {
    const next = await buildAppleClientSecret(APPLE_CONFIG);
    cachedAppleClientSecret = next;
    if (appleRefreshTimer) clearTimeout(appleRefreshTimer);
    // Refresh 1 minute before the 5-minute token expires.
    appleRefreshTimer = setTimeout(
      () => {
        void refreshAppleClientSecret();
      },
      4 * 60 * 1000,
    );
    return next;
  } catch (err) {
    console.error('[auth] Failed to refresh Apple client secret', err);
    return cachedAppleClientSecret;
  }
}

// Top-level await blocks module load until the cache is populated,
// so the Apple provider's sync clientSecret getter always returns a
// valid JWT on the first token exchange. JWT signing is sub-millisecond,
// so the startup cost is negligible. If env vars are missing the await
// is skipped and the provider is not constructed.
if (APPLE_CONFIG) {
  await refreshAppleClientSecret();
}

function appleProvider() {
  if (!APPLE_CONFIG) return null;
  const base = AppleProvider({
    clientId: APPLE_CONFIG.clientId,
    clientSecret: cachedAppleClientSecret ?? '',
  });
  return {
    ...base,
    options: {
      ...base.options,
      clientSecret: cachedAppleClientSecret ?? '',
    },
    get clientSecret() {
      return cachedAppleClientSecret ?? '';
    },
  };
}

function facebookProvider() {
  const clientId = process.env.AUTH_FACEBOOK_ID;
  const clientSecret = process.env.AUTH_FACEBOOK_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return FacebookProvider({
    clientId,
    clientSecret,
  });
}

function buildProviders() {
  const providers: NextAuthOptions['providers'] = [
    ...(process.env.DEV_AUTH_ENABLED === 'true' ? [devCredentialsProvider()] : []),
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ];
  const apple = appleProvider();
  if (apple) providers.push(apple as NextAuthOptions['providers'][number]);
  const facebook = facebookProvider();
  if (facebook) providers.push(facebook as NextAuthOptions['providers'][number]);
  return providers;
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // OAuth providers (google/apple/facebook): resolve the OAuth
      // profile to our internal user id via the LinkedIdentity table.
      // The signIn callback already validated the identity; we only
      // re-query here because NextAuth's profile is read-only and we
      // cannot stash the user id on it.
      if (account?.provider && isOAuthProvider(account.provider)) {
        // If the user is already signed in, this OAuth callback is a
        // "link" flow (FPP-31). Preserve the existing token.sub so the
        // session is not replaced by whatever findOrCreateUserByIdentity
        // would resolve to. The LinkedIdentity row was already created
        // (or rejected) by the signIn callback.
        if (token.sub) {
          return token;
        }
        const provider = account.provider as OAuthProvider;
        const providerAccountId = extractProviderAccountId(provider, profile);
        if (!providerAccountId) {
          return token;
        }
        const email = extractEmail(profile);
        const userId = await resolveIdentityToUserId(provider, providerAccountId, email);
        if (userId) {
          token.sub = userId;
        }
        return token;
      }
      if (account?.provider === 'dev-credentials' && user?.id) {
        token.sub = user.id;
        return token;
      }
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, role: true, householdId: true },
        });
        if (user) {
          session.user.id = user.id;
          session.user.role = user.role;
          session.user.householdId = user.householdId;
        }
      }
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === 'dev-credentials') {
        return true;
      }
      if (!account || !isOAuthProvider(account.provider)) {
        return false;
      }
      const provider = account.provider as OAuthProvider;
      const providerAccountId = extractProviderAccountId(provider, profile);
      if (!providerAccountId) {
        return false;
      }
      // Validate now (and write the audit entry) so a soft-deleted
      // tombstone gets refused before the redirect back to the app.
      const email = extractEmail(profile);
      const resolved = await findOrCreateUserByIdentity({
        provider,
        providerAccountId,
        emailSnapshot: email,
      });
      return resolved !== null;
    },
  },
};

function extractProviderAccountId(provider: OAuthProvider, profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  if (provider === 'apple') {
    const sub = p.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  }
  if (provider === 'facebook') {
    const id = p.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  if (provider === 'google') {
    const sub = p.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  }
  return null;
}

function extractEmail(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  const candidate = p.email;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }
  return null;
}

export { getServerSession } from 'next-auth';

/**
 * Returns the providers that are configured at runtime. The login UI
 * uses this to decide which buttons to show — providers without
 * env credentials are skipped so a misconfigured production deploy
 * does not show a button that always fails.
 */
export function getEnabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push('google');
  if (APPLE_CONFIG) providers.push('apple');
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) providers.push('facebook');
  return providers;
}
