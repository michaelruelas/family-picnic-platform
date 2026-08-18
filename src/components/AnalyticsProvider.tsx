'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getPostHog, identify, reset } from '~/lib/analytics';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const ph = getPostHog();
    if (!ph) return;

    if (session?.user?.id) {
      identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    } else {
      reset();
    }
  }, [session]);

  return <>{children}</>;
}
