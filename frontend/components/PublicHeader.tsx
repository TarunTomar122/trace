"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { displaySerif } from '@/lib/home-fonts';
import { trackLandingCTAClicked } from '@/lib/posthog';

// The site header, styled after join1440.com: serif wordmark, plain links,
// a quiet "Open the feed" and one lavender call to action (the daily email).
const links = [
  ['Daily Brief', '/brief'],
  ['How it works', '/how-it-works'],
  ['Agents', '/agents'],
  ['Guides', '/blog'],
  ['Compare', '/compare'],
  ['Newsletters', '/newsletters'],
] as const;

// Phones get the same links plus the ones only the footer carries on desktop.
const mobileLinks = [...links, ['Resources', '/resources']] as const;

const FEED_HREF = '/feed?utm_source=site&utm_medium=header';

export default function PublicHeader({
  subscribeHref = '/brief#subscribe',
}: {
  /**
   * Where "Subscribe" goes: the form on /brief by default (the homepage sends
   * signed-in visitors to /feed), or `#subscribe` / `#join` on pages with their own.
   */
  subscribeHref?: string;
} = {}) {
  const pathname = usePathname();
  // Same as the homepage's old nav link, so the landing CTA numbers carry on.
  const onFeedClick = () => {
    if (pathname === '/') trackLandingCTAClicked('read', 'nav', { destination: 'feed' });
  };
  // A same-page form: once the anchor has scrolled, put the cursor in the email field.
  const onSubscribeClick = () => {
    if (!subscribeHref.startsWith('#')) return;
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`${subscribeHref} input[type="email"]`)?.focus({ preventScroll: true });
    }, 350);
  };
  return (
    <header className={`${displaySerif.variable} sticky top-0 z-50 border-b border-[#e5e5e5] bg-white text-[#0a0a0a]`}>
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-9 px-4 sm:px-6">
        <Link href="/" aria-label="Trace home" className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true" className="font-[family-name:var(--font-hp-serif)] text-[30px] font-bold leading-none tracking-[-0.005em]">Trace</span>
          <Image src="/trace.webp" width={28} height={28} alt="" className="h-7 w-7" priority />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 whitespace-nowrap text-[16px] min-[1100px]:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="underline-offset-4 hover:underline">{label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <Link href={FEED_HREF} onClick={onFeedClick} className="hidden whitespace-nowrap text-[16px] underline-offset-4 hover:underline sm:inline">
            Open the feed
          </Link>
          <Link
            href={subscribeHref}
            onClick={onSubscribeClick}
            className="inline-flex h-[38px] items-center whitespace-nowrap rounded-[4px] bg-[#edeffd] px-3.5 text-[16px] text-[#1634cc] transition-colors hover:bg-[#dfe3fb]"
          >
            Subscribe
          </Link>
          <details className="relative min-[1100px]:hidden">
            <summary aria-label="Open navigation" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-[4px] border border-[#c7c7c7] [&::-webkit-details-marker]:hidden">
              <Menu size={18} aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile primary" className="absolute right-0 top-[50px] z-50 grid w-[min(280px,calc(100vw-32px))] rounded-[8px] border border-[#e5e5e5] bg-white p-2 shadow-[0_12px_32px_rgba(10,10,10,0.12)]">
              {mobileLinks.map(([label, href]) => (
                <Link key={href} href={href} className="flex min-h-11 items-center rounded-[4px] px-3 text-[16px] hover:bg-[#f7f7f8]">{label}</Link>
              ))}
              <Link href={FEED_HREF} onClick={onFeedClick} className="mt-1 flex min-h-11 items-center rounded-[4px] border-t border-[#e5e5e5] px-3 text-[16px] font-semibold hover:bg-[#f7f7f8]">
                Open the feed
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
