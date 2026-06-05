import Link from 'next/link';
import Image from 'next/image';

export default function FeedFooter({
  stocksBrewMedium = 'feed_footer',
}: {
  stocksBrewMedium?: string;
}) {
  const stocksBrewUrl = new URL('https://stocksbrew.online/');
  stocksBrewUrl.searchParams.set('utm_source', 'trace');
  stocksBrewUrl.searchParams.set('utm_medium', stocksBrewMedium);
  stocksBrewUrl.searchParams.set('utm_campaign', 'cross_product_nav');

  return (
    <footer className="relative overflow-hidden border-t border-[#e5e7eb] px-4 py-14 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none text-center">
        <p className="text-[clamp(4rem,15vw,10rem)] font-bold leading-none tracking-[-0.04em] text-[#f3f4f6]">
          TRACE
        </p>
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/trace.webp" alt="Trace" width={18} height={18} className="h-[18px] w-auto" />
            <span className="text-[12px] font-bold tracking-[0.12em] text-[#9ca3af]">TRACE</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#9ca3af]">
            <Link href="/blog" className="hover:text-[#111827] transition-colors">Blog</Link>
            <Link href="/compare" className="hover:text-[#111827] transition-colors">Compare</Link>
            <a
              href={stocksBrewUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111827] transition-colors"
            >
              StocksBrew
            </a>
            <Link href="/privacy-policy" className="hover:text-[#111827] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#111827] transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-[#111827] transition-colors">Contact</Link>
          </div>
        </div>
        <p className="mt-8 text-center text-[12px] text-[#9ca3af]">
          © {new Date().getFullYear()} Trace. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
