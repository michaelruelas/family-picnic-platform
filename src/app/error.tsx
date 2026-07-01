'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <div className="text-8xl">😔</div>
        <h1 className="mt-6 text-4xl font-bold text-stone-900">Something Went Wrong</h1>
        <p className="mt-4 text-lg text-stone-600">
          We encountered an unexpected error. Our team has been notified.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg bg-amber-600 px-6 py-3 text-lg font-medium text-white hover:bg-amber-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-lg bg-stone-200 px-6 py-3 text-lg font-medium text-stone-700 hover:bg-stone-300"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
