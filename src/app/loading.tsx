export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="shimmer h-10 w-72 rounded-2xl" />
          <div className="shimmer h-5 w-96 rounded-2xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card shadow-card ring-border/60 rounded-3xl p-7 ring-1">
              <div className="shimmer h-7 w-3/4 rounded-2xl" />
              <div className="shimmer mt-3 h-4 w-1/2 rounded-2xl" />
              <div className="shimmer mt-5 h-4 w-full rounded-2xl" />
              <div className="shimmer mt-2 h-4 w-2/3 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
