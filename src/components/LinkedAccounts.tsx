'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { trpc } from '~/lib/trpc-client';

type OAuthProvider = 'google' | 'apple' | 'facebook';

interface LinkedIdentity {
  id: string;
  provider: string;
  providerAccountId: string;
  emailSnapshot: string | null;
  createdAt: Date;
}

interface LinkedAccountsProps {
  enabledProviders: OAuthProvider[];
  sessionEmail: string;
}

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

const PROVIDER_ORDER: OAuthProvider[] = ['google', 'apple', 'facebook'];

export default function LinkedAccounts({ enabledProviders, sessionEmail }: LinkedAccountsProps) {
  const utils = trpc.useUtils();
  const { data: identities = [], isLoading } = trpc.user.listLinkedIdentities.useQuery();
  const unlink = trpc.user.unlinkIdentity.useMutation({
    onSuccess: () => {
      void utils.user.listLinkedIdentities.invalidate();
    },
  });

  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<OAuthProvider | null>(null);

  const linkedProviders = new Set(identities.map((i) => i.provider));
  const unlinkedProviders = PROVIDER_ORDER.filter(
    (p) => enabledProviders.includes(p) && !linkedProviders.has(p),
  );

  async function handleUnlink(identity: LinkedIdentity) {
    const providerLabel = PROVIDER_LABELS[identity.provider as OAuthProvider] ?? identity.provider;
    if (!confirm(`Stop signing in with ${providerLabel}? You can re-link it later.`)) {
      return;
    }
    setUnlinkingId(identity.id);
    setError(null);
    try {
      await unlink.mutateAsync({ identityId: identity.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlink account.');
    } finally {
      setUnlinkingId(null);
    }
  }

  function handleLink(provider: OAuthProvider) {
    setLinkingProvider(provider);
    setError(null);
    void signIn(provider, { callbackUrl: '/profile' });
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
          🔗
        </div>
        <div className="flex-1">
          <h2 className="text-foreground text-xl font-semibold">Connected Accounts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in with any of these providers. We link by matching the email on the account to
            your profile ({sessionEmail}).
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground mt-6 text-sm">Loading...</p>
      ) : identities.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No connected accounts yet. Sign in with a provider below to add one.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {identities.map((identity) => (
            <li
              key={identity.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-foreground font-medium">
                  {PROVIDER_LABELS[identity.provider as OAuthProvider] ?? identity.provider}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {identity.emailSnapshot ?? '(no email on file)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(identity)}
                disabled={unlinkingId === identity.id || identities.length === 1}
                title={
                  identities.length === 1
                    ? 'You must have at least one way to sign in.'
                    : 'Remove this provider'
                }
                className="text-destructive hover:text-foreground text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                {unlinkingId === identity.id ? 'Removing...' : 'Unlink'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {unlinkedProviders.length > 0 && (
        <div className="mt-6 border-t border-stone-200 pt-6">
          <p className="text-foreground/85 text-sm font-medium">Link another account</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Sign in with the new provider. If the email matches your account, we&apos;ll link it
            automatically. Use a different email only if you want to create a new account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlinkedProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleLink(provider)}
                disabled={linkingProvider !== null}
                className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {linkingProvider === provider ? 'Opening...' : `Link ${PROVIDER_LABELS[provider]}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
