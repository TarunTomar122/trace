"use client";

import Link from 'next/link';

export default function PublicHeader() {
  return (
    <header className="bg-background border-b border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.12em] text-foreground">TRACE</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/trending"
              className="text-sm text-secondary hover:text-foreground transition-colors"
            >
              Trending
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
