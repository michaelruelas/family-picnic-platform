export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-48 rounded bg-stone-200" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="h-6 w-3/4 rounded bg-stone-200" />
              <div className="mt-3 h-4 w-1/2 rounded bg-stone-200" />
              <div className="mt-4 h-4 w-full rounded bg-stone-200" />
              <div className="mt-2 h-4 w-2/3 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
