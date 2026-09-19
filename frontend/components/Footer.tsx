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
  const dark = props.variant === 'landing';
  const heading = dark ? 'mb-5 text-[12px] font-semibold text-[#1d9bf0]' : 'mb-5 text-[12px] font-semibold text-foreground';
  const link = dark ? 'text-[#93a5b1] hover:text-white' : 'text-secondary hover:text-foreground';
  return (
    <footer data-variant={props.variant ?? 'default'} className={`px-5 py-14 sm:px-8 sm:py-20 ${dark ? 'rounded-t-[32px] text-white' : 'border-t border-[#eff3f4] text-[#0f1419]'}`} style={{ backgroundColor: dark ? '#0c1216' : '#ffffff' }}>
      <div className="mx-auto max-w-[1180px]">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex min-h-11 items-center gap-3">
              <Image src="/trace.webp" width={64} height={28} alt="" className={`h-7 w-auto ${dark ? 'rounded-lg bg-white p-1' : ''}`} />
              {dark && <span className="text-[19px] font-extrabold tracking-tight text-white">Trace</span>}
            </Link>
            <p className={`mt-5 max-w-[280px] text-pretty text-[15px] leading-[1.65] ${dark ? 'text-[#93a5b1]' : 'text-secondary'}`}>The fastest way to catch up on tech and AI news.</p>
          </div>

          <nav aria-label="Explore" className="space-y-3 text-[14px]">
            <p className={heading}>Explore</p>
            <a href="/feed" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Feed</a>
            <Link href="/how-it-works" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>How it works</Link>
            <Link href="/agents" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Agents</Link>
            <Link href="/subscribe" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Pricing</Link>
          </nav>

          <nav aria-label="Learn" className="space-y-3 text-[14px]">
            <p className={heading}>Learn</p>
            <Link href="/blog" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Guides</Link>
            <Link href="/resources" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Resources</Link>
            <Link href="/compare" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Compare</Link>
            <Link href="/newsletters" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Newsletter reviews</Link>
            <a href="/rss.xml" className={`inline-flex min-h-11 items-center gap-1.5 md:min-h-0 ${link}`}><Rss size={13} />RSS</a>
          </nav>

          <nav aria-label="More" className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 text-[14px] md:col-span-1 md:block md:space-y-3">
            <p className={heading}>More</p>
            <a href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app" className={`inline-flex min-h-11 items-center gap-1.5 md:min-h-0 ${link}`}><Smartphone size={13} />Android app</a>
            <a href={`https://stocksbrew.online/?utm_source=trace&utm_medium=${encodeURIComponent(props.stocksBrewMedium || 'footer')}`} target="_blank" rel="noopener noreferrer" className={`flex min-h-11 items-center gap-1.5 md:min-h-0 ${link}`}><LineChart size={13} strokeWidth={1.8} />StocksBrew <ExternalLink size={11} /></a>
            <Link href="/privacy-policy" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Privacy</Link>
            <Link href="/terms" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Terms</Link>
            <Link href="/contact" className={`flex min-h-11 items-center md:min-h-0 ${link}`}>Contact</Link>
          </nav>
        </div>

        <div className={`mt-14 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[12px] ${dark ? 'border-white/10 text-[#7b8d99]' : 'border-[#eff3f4] text-secondary'}`}>
          <p>© 2026 Trace</p>
          <p>Read 400+ sources, catch up in minutes.</p>
        </div>
      </div>
      {props.directoryBadges && <DirectoryBadgeMarquee badges={props.directoryBadges} />}
    </footer>
  );
}
