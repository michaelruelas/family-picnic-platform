export default function PhotosPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Photo Gallery</h1>
      <p className="mt-2 text-stone-600">Share and enjoy photos from our family moments</p>

      <div className="mt-12 rounded-2xl bg-amber-50 p-8 text-center">
        <div className="text-5xl">📸</div>
        <h2 className="mt-4 text-xl font-semibold text-amber-900">Coming Soon</h2>
        <p className="mt-2 text-amber-700">
          Photo sharing will be available after our first event.
        </p>
      </div>
    </main>
  );
}
