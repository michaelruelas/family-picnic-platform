'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { ThemeProvider } from '~/components/theme-provider';
import TRPCProvider from './TRPCProvider';
import OfflineBanner from './ui/OfflineBanner';
import { ToastProvider } from './ui/Toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
      } else {
        // In development, automatically unregister active service workers and clear caches
        navigator.serviceWorker.getRegistrations?.().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) {
              caches.delete(name);
            }
          });
        }
      }
    }
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        themes={['light', 'dark']}
      >
        <TRPCProvider>
          <ToastProvider>
            <OfflineBanner />
            {children}
          </ToastProvider>
        </TRPCProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
