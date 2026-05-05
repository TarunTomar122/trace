"use client";

import Image from 'next/image';
import Link from 'next/link';

export default function PublicHeader({
  ctaLabel = 'Subscribe',
  ctaHref = '/profile?tab=subscription',
}: {
  ctaLabel?: string;
  ctaHref?: string;
} = {}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/[0.06] bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/trace.webp"
              alt="Trace"
              width={20}
              height={20}
              priority
              className="h-5 w-auto"
            />
            <span className="text-[13px] font-semibold tracking-[0.2em]">TRACE</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/trending"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Trending
            </Link>
            <Link
              href="/daily"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Daily
            </Link>
            <Link
              href="/blog"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Blog
            </Link>
            <div className="ml-3 h-4 w-px bg-border/10" />
          </nav>

          <Link
            href={ctaHref}
            className="rounded-full bg-foreground px-5 py-2 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
