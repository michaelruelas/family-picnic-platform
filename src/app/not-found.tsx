import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <div className="text-8xl">🔍</div>
        <h1 className="mt-6 text-4xl font-bold text-stone-900">Page Not Found</h1>
        <p className="mt-4 text-lg text-stone-600">
          Sorry, we couldn&apos;t find what you&apos;re looking for.
        </p>
        <p className="mt-2 text-stone-500">
          The page may have been moved, deleted, or never existed.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/"
            className="rounded-lg bg-amber-600 px-6 py-3 text-lg font-medium text-white hover:bg-amber-700"
          >
            Go Home
          </Link>
          <Link
            href="/events"
            className="rounded-lg bg-stone-200 px-6 py-3 text-lg font-medium text-stone-700 hover:bg-stone-300"
          >
            Browse Events
          </Link>
        </div>
      </div>
    </main>
  );
}
