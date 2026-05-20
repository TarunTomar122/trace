"use client";

import Image from 'next/image';
import Link from 'next/link';

export default function PublicHeader({
  ctaLabel = 'Subscribe',
  ctaHref = '/profile?tab=subscription',
  variant = 'default',
}: {
  ctaLabel?: string;
  ctaHref?: string;
  variant?: 'default' | 'landing';
} = {}) {
  if (variant === 'landing') {
    return (
      <header className="sticky top-0 z-50 bg-transparent px-4 pt-4 sm:px-6">
        <div className="landing-nav">
          <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ color: 'inherit' }}>
            <Image src="/trace.webp" alt="Trace" width={22} height={22} priority className="h-[22px] w-auto" />
            <span className="text-[13px] font-bold tracking-[0.12em]">TRACE</span>
          </Link>
          <nav className="landing-nav-links">
            <Link href="/compare" className="landing-nav-link">
              Compare
            </Link>
            <Link href="/solutions" className="landing-nav-link">
              Solutions
            </Link>
            <Link href="/use-cases" className="landing-nav-link">
              Use Cases
            </Link>
            <Link href="/resources" className="landing-nav-link">
              Resources
            </Link>
            <Link href="/blog" className="landing-nav-link">
              Blog
            </Link>
          </nav>
          <Link href={ctaHref} className="landing-btn landing-btn-primary landing-btn-sm">
            {ctaLabel}
          </Link>
        </div>
      </header>
    );
  }

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
              href="/compare"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Compare
            </Link>
            <Link
              href="/solutions"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Solutions
            </Link>
            <Link
              href="/use-cases"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Use Cases
            </Link>
            <Link
              href="/resources"
              className="rounded-full px-4 py-1.5 text-[13px] text-secondary/70 transition-colors hover:text-foreground"
            >
              Resources
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
