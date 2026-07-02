export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="animate-pulse space-y-2">
        <div className="h-9 w-40 rounded bg-stone-200" />
        <div className="h-5 w-72 rounded bg-stone-200" />
      </div>

      <section className="mt-8">
        <div className="h-6 w-44 rounded bg-stone-200" />
        <div className="mt-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-6 w-48 rounded bg-stone-200" />
                    <div className="h-6 w-20 rounded-full bg-stone-100" />
                  </div>
                  <div className="h-4 w-64 rounded bg-stone-200" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 w-24 rounded bg-stone-100" />
                  <div className="h-4 w-16 rounded bg-stone-100" />
                </div>
              </div>
              <div className="mt-3 h-4 w-40 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="h-6 w-36 rounded bg-stone-200" />
        <div className="mt-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 opacity-75 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-6 w-48 rounded bg-stone-200" />
                    <div className="h-6 w-16 rounded-full bg-stone-100" />
                    <div className="h-6 w-20 rounded-full bg-stone-100" />
                  </div>
                  <div className="h-4 w-64 rounded bg-stone-200" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 w-24 rounded bg-stone-100" />
                  <div className="h-4 w-16 rounded bg-stone-100" />
                </div>
              </div>
              <div className="mt-3 h-4 w-40 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 rounded-2xl bg-stone-100 p-8">
        <div className="mx-auto h-6 w-56 rounded bg-stone-200" />
        <div className="mx-auto mt-2 h-4 w-64 rounded bg-stone-200" />
        <div className="mx-auto mt-4 h-10 w-40 rounded bg-stone-200" />
      </div>
    </main>
  );
}
