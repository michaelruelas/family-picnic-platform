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
    <main className="mx-auto max-w-2xl px-5 py-24">
      <div className="bg-card shadow-card ring-border/60 rounded-sm p-12 text-center ring-1">
        <div className="text-7xl">🌧️</div>
        <h1 className="font-display text-foreground mt-6 text-4xl font-semibold tracking-tight">
          A little rain on the picnic
        </h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          We hit a snag loading this page. Give it another try, and if the clouds stick around, let
          us know.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="bg-terracotta shadow-soft press rounded-sm px-7 py-3 font-semibold text-white hover:bg-[#cf6c52]"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="border-border bg-card text-foreground press hover:border-foreground rounded-sm border px-7 py-3 font-semibold"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
