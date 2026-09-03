import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, LineChart, Rss, Smartphone } from 'lucide-react';

type DirectoryBadge = {
  name: string;
  href: string;
  imageSrc?: string;
};

function DirectoryBadgeMarquee({ badges }: { badges: DirectoryBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div aria-label="Trace directory listings" className="mx-auto mt-6 max-w-[1180px] overflow-hidden">
      <div className="flex w-max animate-[trace-directory-marquee_28s_linear_infinite] items-center gap-2 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...badges, ...badges].map((badge, index) => (
          <a key={`${badge.name}-${index}`} href={badge.href} target="_blank" rel="noopener noreferrer" className="flex h-11 shrink-0 items-center rounded-full bg-surface-secondary px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-secondary hover:text-foreground md:h-7">
            {badge.imageSrc ? <img src={badge.imageSrc} alt={badge.name} className="h-4 w-auto opacity-65 grayscale" /> : badge.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Footer(props: { variant?: 'default' | 'landing'; directoryBadges?: DirectoryBadge[]; stocksBrewMedium?: string } = {}) {
  return (
    <footer data-variant={props.variant ?? 'default'} className="border-t border-[#eff3f4] px-5 py-14 text-[#0f1419] sm:px-8 sm:py-20" style={{ backgroundColor: '#ffffff' }}>
      <div className="mx-auto max-w-[1180px]">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex min-h-11 items-center gap-3">
              <Image src="/trace.webp" width={64} height={28} alt="" className="h-7 w-auto" />
            </Link>
            <p className="mt-5 max-w-[280px] text-pretty text-[15px] leading-[1.65] text-secondary">The fastest way to catch up on tech and AI news.</p>
          </div>

          <nav aria-label="Explore" className="space-y-3 text-[14px]">
            <p className="mb-5 text-[12px] font-semibold text-foreground">Explore</p>
            <a href="/feed" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Feed</a>
            <Link href="/how-it-works" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">How it works</Link>
            <Link href="/agents" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Agents</Link>
            <Link href="/subscribe" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Pricing</Link>
          </nav>

          <nav aria-label="Learn" className="space-y-3 text-[14px]">
            <p className="mb-5 text-[12px] font-semibold text-foreground">Learn</p>
            <Link href="/blog" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Guides</Link>
            <Link href="/resources" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Resources</Link>
            <Link href="/compare" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Compare</Link>
            <Link href="/newsletters" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Newsletter reviews</Link>
            <a href="/rss.xml" className="inline-flex min-h-11 items-center gap-1.5 text-secondary hover:text-foreground md:min-h-0"><Rss size={13} />RSS</a>
          </nav>

          <nav aria-label="More" className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 text-[14px] md:col-span-1 md:block md:space-y-3">
            <p className="mb-5 text-[12px] font-semibold text-foreground">More</p>
            <a href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app" className="inline-flex min-h-11 items-center gap-1.5 text-secondary hover:text-foreground md:min-h-0"><Smartphone size={13} />Android app</a>
            <a href={`https://stocksbrew.online/?utm_source=trace&utm_medium=${encodeURIComponent(props.stocksBrewMedium || 'footer')}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 text-secondary hover:text-foreground md:min-h-0"><LineChart size={13} strokeWidth={1.8} />StocksBrew <ExternalLink size={11} /></a>
            <Link href="/privacy-policy" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Privacy</Link>
            <Link href="/terms" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Terms</Link>
            <Link href="/contact" className="flex min-h-11 items-center text-secondary hover:text-foreground md:min-h-0">Contact</Link>
          </nav>
        </div>

        <div className="mt-14 text-[12px] text-secondary">
          <p>© 2026 Trace</p>
        </div>
      </div>
      {props.directoryBadges && <DirectoryBadgeMarquee badges={props.directoryBadges} />}
    </footer>
  );
}
