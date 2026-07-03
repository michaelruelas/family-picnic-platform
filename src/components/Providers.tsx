'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { ThemeProvider } from '~/components/theme-provider';
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
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TRPCProvider>
          <OfflineBanner />
          {children}
        </TRPCProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
