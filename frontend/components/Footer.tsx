import Link from 'next/link';
import { LineChart, Rss, Smartphone } from 'lucide-react';

type DirectoryBadge = {
  name: string;
  href: string;
  imageSrc?: string;
};

function DirectoryBadgeMarquee({ badges }: { badges: DirectoryBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div aria-label="Trace directory listings" className="mx-auto mt-8 max-w-[1180px] overflow-hidden border-t border-[#e4e1d8] pt-4">
      <div className="flex w-max animate-[trace-directory-marquee_28s_linear_infinite] items-center gap-2 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...badges, ...badges].map((badge, index) => (
          <a key={`${badge.name}-${index}`} href={badge.href} target="_blank" rel="noopener noreferrer" className="flex h-6 shrink-0 items-center border border-[#e4e1d8] px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9a9587] transition-colors hover:border-[#c9c4b7] hover:text-[#75705f]">
            {badge.imageSrc ? <img src={badge.imageSrc} alt={badge.name} className="h-4 w-auto opacity-65 grayscale" /> : badge.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Footer(props: { variant?: 'default' | 'landing'; directoryBadges?: DirectoryBadge[] } = {}) {
  return (
    <footer data-variant={props.variant ?? 'default'} className="bg-[#faf9f5] px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 border-t border-[#e4e1d8] pt-8">
        <span className="font-mono text-[11px] font-semibold tracking-[0.24em] text-[#1b1a17]">TRACE</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#75705f]">
          <a href="/feed?view=pulse" className="hover:text-[#2557d6]">Pulse</a>
          <a href="/feed?view=edition" className="hover:text-[#2557d6]">Edition</a>
          <Link href="/compare" className="hover:text-[#2557d6]">Compare</Link>
          <Link href="/blog" className="hover:text-[#2557d6]">Guides</Link>
          <Link href="/resources" className="hover:text-[#2557d6]">Resources</Link>
          <Link href="/agents" className="hover:text-[#2557d6]">Agents</Link>
          <Link href="/solutions" className="hover:text-[#2557d6]">Solutions</Link>
          <Link href="/use-cases" className="hover:text-[#2557d6]">Use cases</Link>
          <Link href="/newsletters" className="hover:text-[#2557d6]">Newsletter reviews</Link>
          <a href="/rss.xml" className="inline-flex items-center gap-1 hover:text-[#2557d6]"><Rss size={11} />RSS</a>
          <Link href="/how-it-works" className="hover:text-[#2557d6]">How it works</Link>
          <Link href="/privacy-policy" className="hover:text-[#2557d6]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#2557d6]">Terms</Link>
          <Link href="/contact" className="hover:text-[#2557d6]">Contact</Link>
        </nav>
      </div>
      <div className="mx-auto mt-6 max-w-[1180px] border-t border-[#e4e1d8] pt-5">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#75705f]">More from the founder</p>
        <div className="mt-3 grid gap-4">
          <div><a href="https://stocksbrew.online/?utm_source=trace&utm_medium=footer" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70"><LineChart size={15} strokeWidth={1.8} />StocksBrew</a><p className="mt-1 text-[12px] text-[#75705f]">Know what to do with your stock.</p></div>
          <div><a href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app" className="inline-flex items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70"><Smartphone size={15} strokeWidth={1.8} />Trace - Android</a><p className="mt-1 text-[12px] text-[#75705f]">TikTok for news.</p></div>
        </div>
      </div>
      {props.directoryBadges && <DirectoryBadgeMarquee badges={props.directoryBadges} />}
    </footer>
  );
}
