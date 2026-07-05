export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="animate-pulse space-y-2">
        <div className="bg-secondary h-9 w-40 rounded" />
        <div className="bg-secondary h-5 w-72 rounded" />
      </div>

      <section className="mt-8">
        <div className="bg-secondary h-6 w-44 rounded" />
        <div className="mt-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="bg-secondary h-6 w-48 rounded" />
                    <div className="bg-secondary h-6 w-20 rounded-full" />
                  </div>
                  <div className="bg-secondary h-4 w-64 rounded" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="bg-secondary h-4 w-24 rounded" />
                  <div className="bg-secondary h-4 w-16 rounded" />
                </div>
              </div>
              <div className="bg-secondary mt-3 h-4 w-40 rounded" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="bg-secondary h-6 w-36 rounded" />
        <div className="mt-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-6 opacity-75 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="bg-secondary h-6 w-48 rounded" />
                    <div className="bg-secondary h-6 w-16 rounded-full" />
                    <div className="bg-secondary h-6 w-20 rounded-full" />
                  </div>
                  <div className="bg-secondary h-4 w-64 rounded" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="bg-secondary h-4 w-24 rounded" />
                  <div className="bg-secondary h-4 w-16 rounded" />
                </div>
              </div>
              <div className="bg-secondary mt-3 h-4 w-40 rounded" />
            </div>
          ))}
        </div>
      </section>

      <div className="bg-secondary mt-12 rounded-2xl p-8">
        <div className="bg-secondary mx-auto h-6 w-56 rounded" />
        <div className="bg-secondary mx-auto mt-2 h-4 w-64 rounded" />
        <div className="bg-secondary mx-auto mt-4 h-10 w-40 rounded" />
      </div>
    </main>
  );
}
