"use client";

import Link from 'next/link';

interface PublicHeaderProps {
  backHref?: string;
  backLabel?: string;
  showHome?: boolean;
}

export default function PublicHeader({
  showHome = true,
}: PublicHeaderProps) {
  return (
    <header className="sticky top-0 bg-white/95 dark:bg-[#101014]/95 backdrop-blur-md z-50">
      <div className="mx-auto px-6 lg:px-10 max-w-[1600px]">
        <div className="flex items-center justify-between h-16">
          {/* Left - Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-[0.12em] text-foreground">TRACE</span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-2">
            {showHome && (
              <Link
                href="/"
                className="px-4 py-2 rounded-full text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
