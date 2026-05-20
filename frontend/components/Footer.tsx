import Link from 'next/link';

export default function Footer(_props: { variant?: 'default' | 'landing' } = {}) {
  return (
    <footer className="border-t border-black/[0.04] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-4 w-auto" />
            <span className="text-[11px] font-semibold tracking-[0.18em] text-secondary/50">TRACE</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-secondary/50">
            <Link href="/compare" className="transition-colors hover:text-foreground">Compare</Link>
            <Link href="/solutions" className="transition-colors hover:text-foreground">Solutions</Link>
            <Link href="/use-cases" className="transition-colors hover:text-foreground">Use Cases</Link>
            <Link href="/resources" className="transition-colors hover:text-foreground">Resources</Link>
            <Link href="/blog" className="transition-colors hover:text-foreground">Blog</Link>
            <Link href="/onboarding?intent=read" className="transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/privacy-policy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
