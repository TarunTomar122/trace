"use client";

import Link from 'next/link';

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/trending"
              className="hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-medium text-secondary transition-colors hover:text-foreground"
            >
              Trending
            </Link>
            <Link
              href="/"
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
