import Link from 'next/link';

export default function PublicHeader({
  ctaLabel = 'Start reading',
  ctaHref = '/feed?view=pulse',
}: {
  ctaLabel?: string;
  ctaHref?: string;
  variant?: 'default' | 'landing';
} = {}) {
  return (
    <header className="sticky top-0 z-50 isolate px-5 sm:px-8" style={{ backgroundColor: '#faf9f5' }}>
      <div className="mx-auto flex max-w-[1180px] items-center justify-between border-b border-[#e4e1d8] py-4">
        <Link href="/" className="font-mono text-[12.5px] font-bold tracking-[0.28em] text-[#1b1a17]">
          TRACE
        </Link>
        <nav className="hidden items-center gap-5 text-[13px] font-medium text-[#75705f] sm:flex">
          <a href="/feed?view=pulse" className="transition-colors hover:text-[#2557d6]">Pulse</a>
          <a href="/feed?view=edition" className="transition-colors hover:text-[#2557d6]">Edition</a>
          <Link href="/compare" className="transition-colors hover:text-[#2557d6]">Compare</Link>
          <Link href="/blog" className="transition-colors hover:text-[#2557d6]">Guides</Link>
          <Link href="/resources" className="transition-colors hover:text-[#2557d6]">Resources</Link>
        </nav>
        <Link href={ctaHref} className="border border-[#2557d6] px-3.5 py-1.5 text-[12px] font-semibold text-[#2557d6] transition-colors hover:bg-[#2557d6] hover:text-white">
          {ctaLabel}
        </Link>
      </div>
    </header>
  );
}
