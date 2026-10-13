"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';

const links = [
  ['Feed', '/feed'],
  ['Guides', '/blog'],
  ['Resources', '/resources'],
  ['How it works', '/how-it-works'],
  ['Agents', '/agents'],
  ['Compare', '/compare'],
  ['Newsletters', '/newsletters'],
  ['FAQs', '/#questions'],
] as const;

/** Keep header CTAs attributable even when callers pass a bare /feed href. */
function attributedHref(href: string): string {
  if (!href.startsWith('/feed')) return href;
  if (href.includes('utm_')) return href;
  return `${href}${href.includes('?') ? '&' : '?'}utm_source=site&utm_medium=header`;
}

export default function PublicHeader({
  ctaLabel = 'Start reading free',
  ctaHref = '/feed?utm_source=site&utm_medium=header',
  hideCta = false,
  centerSlot,
  rightSlot,
  showMobileNav = true,
}: {
  ctaLabel?: string;
  ctaHref?: string;
  /** No call-to-action button on the right (the nav links are enough). */
  hideCta?: boolean;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  showMobileNav?: boolean;
  variant?: 'default' | 'landing';
} = {}) {
  const hasCenterSlot = Boolean(centerSlot);
  const [hidden, setHidden] = useState(false);
  const previousScrollY = useRef(0);

  useEffect(() => {
    if (!hasCenterSlot) return;
    previousScrollY.current = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 24) setHidden(false);
      else if (Math.abs(currentScrollY - previousScrollY.current) > 8) setHidden(currentScrollY > previousScrollY.current);
      previousScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasCenterSlot]);

  return (
    <header className={`${hasCenterSlot ? `sticky top-0 transition-transform duration-200 ${hidden ? '-translate-y-full' : 'translate-y-0'}` : 'relative'} z-50 isolate bg-white/90 backdrop-blur-md border-b border-[#eff3f4]`} style={{ padding: '14px clamp(16px, 5vw, 72px)' }}>
      <style>{'@media(max-width:959px){.public-primary-nav{display:none!important}.public-header-grid{grid-template-columns:1fr auto!important}.public-header-center-slot{grid-column:1/-1;grid-row:2}}@media(min-width:960px){.public-mobile-nav{display:none!important}.public-header-center-slot{grid-column:2;grid-row:1}}'}</style>
      <div className="public-header-grid relative w-full" style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) auto minmax(150px, 1fr)', alignItems: 'center', maxWidth: 1120, margin: '0 auto' }}>
        <Link href="/" aria-label="Trace home" className="flex min-h-11 items-center gap-3 text-foreground" style={{ justifySelf: 'start' }}>
          <Image src="/trace.webp" width={64} height={28} alt="" className="h-7 w-auto" />
        </Link>
        {centerSlot ? (
          <div className="public-header-center-slot scrollbar-hide min-w-0 overflow-x-auto pb-2 pt-4 min-[960px]:py-0">{centerSlot}</div>
        ) : (
          <nav aria-label="Primary" className="public-primary-nav text-[13px] font-medium text-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, whiteSpace: 'nowrap' }}>
            {links.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-foreground">{label}</Link>)}
          </nav>
        )}
        <div className="flex items-center gap-2" style={{ justifySelf: 'end' }}>
          {hideCta ? null : rightSlot ?? <Link href={attributedHref(ctaHref)} className="inline-flex min-h-10 items-center rounded-full bg-[#1d9bf0] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#1a8cd8]" style={{ whiteSpace: 'nowrap' }}>{ctaLabel}</Link>}
          {!centerSlot && showMobileNav && (
            <details className="public-mobile-nav relative">
              <summary aria-label="Open navigation" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-foreground/15 text-foreground [&::-webkit-details-marker]:hidden">
                <Menu size={18} aria-hidden="true" />
              </summary>
              <nav aria-label="Mobile primary" className="absolute right-0 top-[52px] z-50 grid w-[min(300px,calc(100vw-32px))] gap-1 rounded-[18px] bg-surface p-2 shadow-lg ring-1 ring-foreground/10">
                {links.map(([label, href]) => <Link key={href} href={href} className="flex min-h-11 items-center rounded-[12px] px-4 text-[14px] font-medium text-foreground hover:bg-surface-secondary">{label}</Link>)}
              </nav>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}
