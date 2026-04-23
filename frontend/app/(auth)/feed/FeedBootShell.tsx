import Link from 'next/link';

const sk = 'animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.09]';
const skBlock = 'animate-pulse rounded-md bg-black/[0.08] dark:bg-white/[0.10]';

function SkeletonLine({ className }: { className: string }) {
  return <div className={`${sk} ${className}`} />;
}

/** Matches `ScrollFeedInterestTabs` chrome */
function ScrollFeedTabBarSkeleton() {
  return (
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-border/20 bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-0.5 pb-0">
        <div className="mx-auto mb-0.5 h-3 w-52 max-w-[90%] rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
      </div>
      <div className="min-w-0 max-w-full overflow-x-hidden pb-0.5">
        <div className="flex w-max min-w-full justify-center">
          <div className="inline-flex shrink-0 items-center gap-1 px-4 sm:px-6 lg:px-8 py-1">
            {[56, 72, 44, 52, 64, 48, 76, 68].map((w) => (
              <div
                key={w}
                style={{ width: w }}
                className="h-8 shrink-0 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row aligned with `ScrollFeedCard` (avatar only sm+) */
function ScrollFeedStorySkeleton({ withImage, isFirst = false }: { withImage: boolean; isFirst?: boolean }) {
  const rowTop = isFirst ? 'pt-2 sm:pt-3' : 'pt-5 sm:pt-6';
  return (
    <article className="border-b border-[#cfd9de] dark:border-white/[0.14] last:border-b-0">
      <div className={`flex gap-3 px-4 ${rowTop} pb-5 sm:pb-6`}>
        <div
          className="hidden sm:block h-10 w-10 shrink-0 rounded-full bg-black/[0.07] dark:bg-white/[0.09] animate-pulse pt-1"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <SkeletonLine className="h-3 w-36 max-w-[55%]" />
          <div className={`${skBlock} h-5 w-full max-w-[98%]`} />
          <div className={`${skBlock} h-5 w-11/12 max-w-[92%]`} />
          <SkeletonLine className="h-3.5 w-full" />
          <SkeletonLine className="h-3.5 w-[94%]" />
          <SkeletonLine className="h-3.5 w-[78%]" />
          <div className="h-4 w-24 rounded-md bg-[#1d9bf0]/15 dark:bg-[#1d9bf0]/25 animate-pulse" />
          {withImage && (
            <div className="h-44 sm:h-52 w-full rounded-2xl border border-[#cfd9de]/60 dark:border-white/10 bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" />
          )}
        </div>
      </div>
    </article>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <ScrollFeedStorySkeleton key={i} withImage={i % 2 === 0} isFirst={i === 0} />
      ))}
    </>
  );
}

/* ─── Editorial Grid Skeleton (desktop lg+) ─── */

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

function EditorialGridSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(200px,1fr)] gap-8 pt-6 pb-12">
      {/* Left sidebar */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className={`${sk} h-2.5 w-20`} />
          <div className="flex-1 h-px bg-border/15" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <EditorialSidebarItemSkeleton key={i} />
        ))}
      </div>

      {/* Center — hero + grid */}
      <div>
        {/* Hero image */}
        <div className="rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse h-[280px] mb-4" />
        {/* Hero meta */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`${sk} h-2.5 w-20`} />
          <div className={`${sk} h-2.5 w-12`} />
        </div>
        {/* Hero title */}
        <div className={`${skBlock} h-7 w-[90%] mb-2`} />
        <div className={`${skBlock} h-7 w-[70%] mb-3`} />
        {/* Hero preview */}
        <div className={`${sk} h-3.5 w-full mb-1.5`} />
        <div className={`${sk} h-3.5 w-[85%] mb-8`} />

        {/* Medium cards grid */}
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="rounded-lg bg-black/[0.05] dark:bg-white/[0.06] animate-pulse h-[150px] mb-3" />
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`${sk} h-2 w-14`} />
                <div className={`${sk} h-2 w-10`} />
              </div>
              <div className={`${skBlock} h-4 w-full mb-1`} />
              <div className={`${skBlock} h-4 w-3/4`} />
            </div>
          ))}
        </div>
      </div>

      {/* Right sidebar */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className={`${sk} h-2.5 w-24`} />
          <div className="flex-1 h-px bg-border/15" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <EditorialSidebarItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Shown while stories load. Use `embedded` inside `FeedBriefingView` (parent already sets column + top padding). */
export function ScrollFeedLoadingSkeleton({
  rows = 6,
  embedded = false,
  editorial = false,
}: {
  rows?: number;
  embedded?: boolean;
  /** Show the 3-column editorial grid skeleton instead of scroll cards */
  editorial?: boolean;
}) {
  if (editorial) {
    return <EditorialGridSkeleton />;
  }
  if (embedded) {
    return <SkeletonRows rows={rows} />;
  }
  return (
    <div className="mx-auto w-full max-w-[min(43rem,100%)] min-h-[calc(100vh-11rem)]">
      <SkeletonRows rows={rows} />
    </div>
  );
}

export default function FeedBootShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" prefetch={false} className="flex items-center gap-3">
              <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
            </Link>
            <div className="h-8 w-8 rounded-full bg-black/[0.08] dark:bg-white/[0.10] animate-pulse" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-0 py-0 sm:px-6 sm:pt-2 sm:pb-5 lg:px-8 lg:pt-3 lg:pb-8">
        <ScrollFeedTabBarSkeleton />
        {/* Editorial grid on desktop, scroll cards on mobile */}
        <div className="hidden lg:block">
          <ScrollFeedLoadingSkeleton editorial />
        </div>
        <div className="lg:hidden">
          <ScrollFeedLoadingSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
