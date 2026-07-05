import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24">
      <div className="bg-card shadow-card ring-border/60 rounded-3xl p-12 text-center ring-1">
        <div className="text-7xl">🧺</div>
        <h1 className="font-display text-foreground mt-6 text-4xl font-semibold tracking-tight">
          We can&apos;t find that page
        </h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          The page you were looking for has wandered off, like a kid chasing a butterfly.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-pill bg-terracotta shadow-soft press px-7 py-3 font-semibold text-white hover:bg-[#cf6c52]"
          >
            Go Home
          </Link>
          <Link
            href="/events"
            className="rounded-pill border-border bg-card text-foreground press hover:border-foreground border px-7 py-3 font-semibold"
          >
            Browse Events
          </Link>
        </div>
      </div>
    </main>
  );
}
