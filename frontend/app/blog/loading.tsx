import PublicHeader from "@/components/PublicHeader";

// Same frame as the blog index (site header, centred hero, grey band of white
// cards) so nothing jumps when the page arrives.
const bar = 'animate-pulse rounded-[4px] bg-[#ececee]';

export default function BlogLoading() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <div aria-busy="true">
        <div className="bg-gradient-to-b from-white via-white to-[#f7f7f8] px-4 pb-14 pt-16 sm:px-6">
          <div className="mx-auto flex max-w-[820px] flex-col items-center">
            <div className={`${bar} h-6 w-16`} />
            <div className={`${bar} mt-6 h-12 w-full max-w-[640px] sm:h-14`} />
            <div className={`${bar} mt-3 h-12 w-3/4 max-w-[480px] sm:h-14`} />
            <div className={`${bar} mt-8 h-4 w-full max-w-[560px]`} />
            <div className={`${bar} mt-2.5 h-4 w-2/3 max-w-[400px]`} />
          </div>
        </div>
        <div className="bg-[#f7f7f8] px-4 pb-24 sm:px-6">
          <div className="mx-auto grid max-w-[1200px] gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
                <div className="aspect-[16/10] animate-pulse bg-[#ececee]" />
                <div className="p-6">
                  <div className={`${bar} h-5 w-20`} />
                  <div className={`${bar} mt-4 h-6 w-full`} />
                  <div className={`${bar} mt-2 h-6 w-2/3`} />
                  <div className={`${bar} mt-4 h-3.5 w-full`} />
                  <div className={`${bar} mt-2 h-3.5 w-4/5`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
