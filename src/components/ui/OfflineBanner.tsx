'use client';

import { useOffline } from '~/hooks/useOffline';

export default function OfflineBanner() {
  const { isOnline } = useOffline();

  if (isOnline) {
    return null;
  }

  return (
    <div className="bg-sunlight text-foreground shadow-pop fixed right-4 bottom-4 left-4 z-50 rounded-2xl px-5 py-3 text-center text-sm font-medium md:left-auto md:max-w-md">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span>You&apos;re offline. Some features are paused.</span>
      </div>
    </div>
  );
}
