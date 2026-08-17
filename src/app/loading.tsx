export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="shimmer h-10 w-72 rounded-sm" />
          <div className="shimmer h-5 w-96 rounded-sm" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card shadow-card ring-border/60 rounded-sm p-7 ring-1">
              <div className="shimmer h-7 w-3/4 rounded-sm" />
              <div className="shimmer mt-3 h-4 w-1/2 rounded-sm" />
              <div className="shimmer mt-5 h-4 w-full rounded-sm" />
              <div className="shimmer mt-2 h-4 w-2/3 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
