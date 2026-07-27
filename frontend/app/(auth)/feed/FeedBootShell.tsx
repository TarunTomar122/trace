function Skel({ className = '' }: { className?: string }) {
  return <div className={`wire-skel ${className}`.trim()} aria-hidden />;
}

function WireMastheadSkeleton() {
  return (
    <header className="wire-masthead">
      <Skel className="h-3 w-28" />
      <Skel className="mt-3 h-9 w-full max-w-md" />
      <Skel className="mt-2 h-4 w-40" />
    </header>
  );
}

function WireHeroSkeleton() {
  return (
    <section className="wire-module wire-module--hero">
      <div className="wire-hero-grid">
        <div className="wire-hero-lead">
          <Skel className="aspect-[16/10] w-full rounded-none" />
          <div className="wire-hero-lead-copy space-y-2.5 pt-4">
            <Skel className="h-7 w-full max-w-[95%]" />
            <Skel className="h-7 w-[75%]" />
            <Skel className="h-3 w-36" />
          </div>
        </div>
        <div className="wire-hero-sidebar">
          {[0, 1].map((i) => (
            <div className="wire-hero-side" key={i}>
              <Skel className="aspect-[16/10] w-full rounded-none" />
              <div className="wire-hero-side-copy space-y-2 pt-3">
                <Skel className="h-4 w-full" />
                <Skel className="h-4 w-[85%]" />
                <Skel className="h-2.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WireSectionHeadSkeleton() {
  return (
    <div className="wire-section-head">
      <Skel className="h-6 w-16 rounded-sm" />
      <span className="wire-section-rule bg-[#e5e7eb]" aria-hidden />
    </div>
  );
}

function WireSectionSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <section className="wire-module">
      <WireSectionHeadSkeleton />
      <div className="wire-section-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div className="wire-section-card pointer-events-none" key={i}>
            <div className="wire-section-card-media">
              <Skel className="wire-section-card-skel-img" />
            </div>
            <div className="wire-section-card-copy space-y-2">
              <Skel className="h-4 w-full" />
              <Skel className="h-4 w-[80%]" />
              <Skel className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WireLatestSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="wire-module wire-module--latest">
      <WireSectionHeadSkeleton />
      <div className="wire-latest-list">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="wire-latest-row pointer-events-none">
            <div className="wire-latest-thumb">
              <Skel className="h-full w-full rounded-none" />
            </div>
            <div className="wire-latest-copy space-y-2">
              <Skel className="h-4 w-full max-w-[98%]" />
              <Skel className="h-4 w-[70%]" />
              <Skel className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Pulse tab skeleton — two-column layout with tweets + sidebar sections. */
export function PulseLoadingSkeleton() {
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[1500px] px-10 py-6 sm:px-16 sm:py-8 lg:px-24">
        <div className="flex flex-col gap-10 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Skel className="mb-5 h-3 w-24 rounded-full" />
            <div className="space-y-0 border-t border-[#e5e7eb]">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex gap-3.5 border-b border-[#f3f4f6] py-4">
                  <Skel className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skel className={`h-3.5 rounded-full ${i % 2 === 0 ? 'w-full' : 'w-[92%]'}`} />
                    <Skel className="h-3 w-[88%] rounded-full" />
                    <Skel className="h-2.5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full space-y-8 sm:w-[300px] sm:shrink-0">
            {['Hacker News', 'GitHub Trending', 'Top blogs'].map((label) => (
              <div key={label}>
                <Skel className="mb-4 h-2.5 w-28 rounded-full" />
                <div className="space-y-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-2">
                      <Skel className="h-2 w-20 rounded-full" />
                      <Skel className={`h-3.5 rounded-full ${i % 2 === 0 ? 'w-full' : 'w-[90%]'}`} />
                      <Skel className="h-3 w-[75%] rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two-pane feed skeleton — matches FeedTwoPaneLayout. */
export function WireFeedLoadingSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* tab bar */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-10 pt-3 pb-3 sm:px-16 lg:px-24">
          <div className="flex items-center gap-6">
            <Skel className="h-3 w-10 rounded-full" />
            <Skel className="h-3 w-10 rounded-full" />
          </div>
          <Skel className="h-2.5 w-28 rounded-full" />
        </div>
      </div>

      {/* panes */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 overflow-hidden px-10 sm:px-16 lg:px-24">
          {/* left pane */}
          <div className="flex w-full flex-col sm:w-[360px] sm:shrink-0 sm:border-r sm:border-[#e5e7eb]">
            {/* left header */}
            <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-6 py-4">
              <div className="flex items-baseline justify-between">
                <Skel className="h-3.5 w-24 rounded-full" />
                <Skel className="h-2.5 w-14 rounded-full" />
              </div>
              {/* pills */}
              <div className="mt-3 flex gap-1.5">
                {[40, 52, 44, 44, 52].map((w, i) => (
                  <div
                    key={i}
                    style={{ width: w }}
                    className="h-6 shrink-0 rounded-full animate-pulse bg-[#f3f4f6]"
                  />
                ))}
              </div>
            </div>
            {/* story rows */}
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="flex gap-4 border-b border-[#e5e7eb]/40 px-6 py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skel className={`h-3.5 rounded-full ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-[85%]' : 'w-[92%]'}`} />
                    <Skel className={`h-3.5 rounded-full ${i % 2 === 0 ? 'w-[70%]' : 'w-[80%]'}`} />
                    <Skel className="h-2.5 w-28 rounded-full" />
                  </div>
                  <Skel className="h-[68px] w-[68px] shrink-0 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* right pane — hidden on mobile */}
          <div className="hidden sm:flex flex-1 flex-col overflow-y-auto bg-white px-10 py-10">
            <Skel className="h-3 w-32 rounded-full" />
            <Skel className="mt-4 h-7 w-full max-w-[90%] rounded-full" />
            <Skel className="mt-2.5 h-7 w-[72%] rounded-full" />
            <Skel className="mt-3 h-2.5 w-36 rounded-full" />
            <Skel className="mt-6 aspect-[16/9] w-full rounded-2xl" />
            <div className="mt-8 space-y-3">
              {[98, 92, 96, 85, 90].map((w, i) => (
                <Skel key={i} className={`h-3.5 w-[${w}%] rounded-full`} />
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-[#e5e7eb] p-5 space-y-3">
              <Skel className="h-2.5 w-24 rounded-full" />
              {[90, 80, 85].map((w, i) => (
                <Skel key={i} className={`h-3 w-[${w}%] rounded-full`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Legacy scroll / briefing skeletons (FeedBriefingView) ─── */

const sk = 'animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.09]';
const skBlock = 'animate-pulse rounded-md bg-black/[0.08] dark:bg-white/[0.10]';

function SkeletonLine({ className }: { className: string }) {
  return <div className={`${sk} ${className}`} />;
}

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
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className={`${sk} h-2.5 w-20`} />
          <div className="flex-1 h-px bg-border/15" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <EditorialSidebarItemSkeleton key={i} />
        ))}
      </div>
      <div>
        <div className="rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse h-[280px] mb-4" />
        <div className="flex items-center gap-2 mb-2">
          <div className={`${sk} h-2.5 w-20`} />
          <div className={`${sk} h-2.5 w-12`} />
        </div>
        <div className={`${skBlock} h-7 w-[90%] mb-2`} />
        <div className={`${skBlock} h-7 w-[70%] mb-3`} />
        <div className={`${sk} h-3.5 w-full mb-1.5`} />
        <div className={`${sk} h-3.5 w-[85%] mb-8`} />
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

/** Shown while stories load. Use `embedded` inside `FeedBriefingView`. */
export function ScrollFeedLoadingSkeleton({
  rows = 6,
  embedded = false,
  editorial = false,
}: {
  rows?: number;
  embedded?: boolean;
  editorial?: boolean;
}) {
  if (editorial) {
    return <EditorialGridSkeleton />;
  }
  if (embedded) {
    return <SkeletonRows rows={rows} />;
  }
  return <WireFeedLoadingSkeleton />;
}

function FeedNavSkeleton() {
  return (
    <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-10 py-3.5 sm:px-16 lg:px-24">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skel className="h-5 w-5 rounded-sm" />
          <Skel className="h-3 w-14 rounded-full" />
        </div>
        <Skel className="h-8 w-8 rounded-full" />
      </div>
    </header>
  );
}

export default function FeedBootShell() {
  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      <div className="mx-auto max-w-[1500px] px-10 sm:px-16 lg:px-24">
        <header className="flex items-center justify-between border-b border-[#e4e1d8] py-4">
          <Skel className="h-3 w-16 rounded-none" />
          <div className="flex gap-5">
            <Skel className="h-2.5 w-12 rounded-none" />
            <Skel className="h-2.5 w-9 rounded-none" />
            <Skel className="h-2.5 w-12 rounded-none" />
          </div>
        </header>
        <section className="pb-10 pt-14 sm:pt-20">
          <Skel className="h-3 w-40 rounded-none" />
          <Skel className="mt-5 h-20 w-full max-w-[600px] rounded-none" />
          <Skel className="mt-6 h-3 w-80 max-w-full rounded-none" />
        </section>
        <div className="border-y border-[#e4e1d8] py-4">
          <div className="flex gap-6 overflow-hidden">
            {[72, 58, 66, 82, 74].map((width) => <Skel key={width} className={`h-3 w-[${width}px] shrink-0 rounded-none`} />)}
          </div>
        </div>
        <div className="pt-10">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-5 border-t border-[#e4e1d8] py-6 sm:gap-7">
              <Skel className="hidden h-7 w-7 shrink-0 rounded-none sm:block" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skel className={`h-8 max-w-full rounded-none ${i % 2 ? 'w-[78%]' : 'w-[92%]'}`} />
                <Skel className="h-3.5 w-full rounded-none" />
                <Skel className="h-3 w-28 rounded-none" />
              </div>
              <Skel className="h-[72px] w-[92px] shrink-0 rounded-none sm:h-[96px] sm:w-[128px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
