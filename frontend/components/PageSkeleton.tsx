const sk = 'animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.09]';
const skBlock = 'animate-pulse rounded-md bg-black/[0.08] dark:bg-white/[0.10]';

function SkeletonLine({ className }: { className: string }) {
  return <div className={`${sk} ${className}`} />;
}

function EditorialSidebarItemSkeleton() {
  return (
    <div className="py-3.5 border-b border-border/10 last:border-0">
      <div className={`${skBlock} h-4 w-full mb-1.5`} />
      <div className={`${skBlock} h-4 w-3/4 mb-2`} />
      <div className="flex items-center gap-2">
        <div className={`${sk} h-2.5 w-16`} />
        <div className={`${sk} h-2.5 w-10`} />
      </div>
    </div>
  );
}

export function TrendingSkeleton() {
  return (
    <div className="space-y-0">
      {/* Hero section skeleton */}
      <section className="pt-2 pb-2 sm:pt-4 sm:pb-2">
        <SkeletonLine className="h-3 w-28" />
        <div className={`${skBlock} mt-3 h-10 w-72`} />
        <div className={`${sk} mt-4 h-4 w-full max-w-lg`} />
        <div className={`${sk} mt-2 h-4 w-3/4 max-w-md`} />
      </section>

      {/* 3-column grid (desktop) */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(200px,1fr)] gap-8 pt-6 pb-12">
        {/* Left — hot tweets */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <SkeletonLine className="h-2.5 w-20" />
            <div className="flex-1 h-px bg-border/15" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <EditorialSidebarItemSkeleton key={i} />
          ))}
        </div>

        {/* Center — hero + grid topics */}
        <div>
          <div className="rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse h-[280px] mb-4" />
          <div className="flex items-center gap-2 mb-2">
            <SkeletonLine className="h-2.5 w-20" />
            <SkeletonLine className="h-2.5 w-12" />
          </div>
          <div className={`${skBlock} h-7 w-[90%] mb-2`} />
          <div className={`${skBlock} h-7 w-[70%] mb-3`} />
          <SkeletonLine className="h-3.5 w-full mb-1.5" />
          <SkeletonLine className="h-3.5 w-[85%] mb-8" />

          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <div className="rounded-lg bg-black/[0.05] dark:bg-white/[0.06] animate-pulse h-[150px] mb-3" />
                <div className="flex items-center gap-2 mb-1.5">
                  <SkeletonLine className="h-2 w-14" />
                  <SkeletonLine className="h-2 w-10" />
                </div>
                <div className={`${skBlock} h-4 w-full mb-1`} />
                <div className={`${skBlock} h-4 w-3/4`} />
              </div>
            ))}
          </div>
        </div>

        {/* Right — stories */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <SkeletonLine className="h-2.5 w-24" />
            <div className="flex-1 h-px bg-border/15" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <EditorialSidebarItemSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Mobile skeleton */}
      <div className="lg:hidden border-t border-border/[0.06]">
        <div className="py-2 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="py-3.5 border-b border-border/[0.06]">
              <div className={`${skBlock} h-4 w-full mb-2`} />
              <div className={`${skBlock} h-4 w-3/4 mb-2`} />
              <div className={`${sk} h-2.5 w-20`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GenericListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      <section className="pt-2 pb-4">
        <SkeletonLine className="h-3 w-24" />
        <div className={`${skBlock} mt-3 h-8 w-56`} />
        <div className={`${sk} mt-4 h-4 w-full max-w-md`} />
      </section>
      <div className="space-y-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="py-4 border-b border-border/[0.06]">
            <div className={`${skBlock} h-5 w-3/4 mb-2`} />
            <div className={`${sk} h-3.5 w-full mb-1`} />
            <div className={`${sk} h-3.5 w-2/3`} />
            <div className="flex items-center gap-2 mt-2">
              <div className={`${sk} h-2.5 w-16`} />
              <div className={`${sk} h-2.5 w-12`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/[0.06] bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded bg-black/[0.08] dark:bg-white/[0.10] animate-pulse" />
            <div className="h-3.5 w-16 rounded-full bg-black/[0.07] dark:bg-white/[0.09] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            {[44, 36, 52, 40].map((w, i) => (
              <div key={i} style={{ width: w }} className="h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
            ))}
          </div>
          <div className="h-8 w-20 rounded-full bg-black/[0.08] dark:bg-white/[0.10] animate-pulse" />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
