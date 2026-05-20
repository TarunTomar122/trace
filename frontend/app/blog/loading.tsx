export default function BlogLoading() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <header className="sticky top-0 z-50 bg-transparent px-4 pt-4 sm:px-6">
        <div className="landing-nav">
          <div className="flex items-center gap-2.5">
            <div className="h-[22px] w-[22px] animate-pulse rounded-md bg-[#e5e7eb]" />
            <div className="h-3.5 w-14 animate-pulse rounded-full bg-[#e5e7eb]" />
          </div>
          <div className="hidden h-3.5 w-10 animate-pulse rounded-full bg-[#e5e7eb] sm:block" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-[#dbeafe]" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="h-3 w-12 animate-pulse rounded-full bg-[#dbeafe]" />
        <div className="mt-4 h-12 w-full max-w-2xl animate-pulse rounded-lg bg-[#e5e7eb]" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded-full bg-[#f3f4f6]" />
        <div className="mt-3 h-4 w-3/4 max-w-lg animate-pulse rounded-full bg-[#f3f4f6]" />
        <div className="mt-14 h-64 animate-pulse rounded-3xl border border-[#e5e7eb] bg-white" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-[#e5e7eb] bg-white" />
          ))}
        </div>
      </main>
    </div>
  );
}
