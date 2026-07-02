'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import TRPCProvider from './TRPCProvider';
import OfflineBanner from './ui/OfflineBanner';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  return (
    <SessionProvider>
      <TRPCProvider>
        <OfflineBanner />
        {children}
      </TRPCProvider>
    </SessionProvider>
  );
}
