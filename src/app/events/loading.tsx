export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="animate-pulse space-y-2">
        <div className="h-9 w-32 rounded bg-stone-200" />
        <div className="h-5 w-80 rounded bg-stone-200" />
      </div>

      <section className="mt-8">
        <div className="h-6 w-40 rounded bg-stone-200" />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-3/4 rounded bg-stone-200" />
                  <div className="h-4 w-1/2 rounded bg-stone-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-stone-100" />
                    <div className="h-4 w-2/3 rounded bg-stone-100" />
                  </div>
                </div>
                <div className="h-24 w-32 rounded-lg bg-stone-200" />
              </div>
              <div className="mt-4 flex gap-4">
                <div className="h-4 w-20 rounded bg-stone-100" />
                <div className="h-4 w-24 rounded bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="h-6 w-32 rounded bg-stone-200" />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 opacity-75 shadow-sm">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-3/4 rounded bg-stone-200" />
                  <div className="h-4 w-1/2 rounded bg-stone-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-stone-100" />
                    <div className="h-4 w-2/3 rounded bg-stone-100" />
                  </div>
                </div>
                <div className="h-24 w-32 rounded-lg bg-stone-200" />
              </div>
              <div className="mt-4 flex gap-4">
                <div className="h-4 w-20 rounded bg-stone-100" />
                <div className="h-4 w-24 rounded bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 rounded-2xl bg-stone-100 p-8">
        <div className="mx-auto h-6 w-64 rounded bg-stone-200" />
        <div className="mx-auto mt-2 h-4 w-80 rounded bg-stone-200" />
        <div className="mx-auto mt-6 h-10 w-40 rounded bg-stone-200" />
      </div>
    </main>
  );
}
