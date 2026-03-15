import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border/20 mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Android App Callout */}
        <div className="mb-12 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border/20 bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background shrink-0">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Trace is on Android</p>
              <p className="text-xs text-secondary">Get the app for the best mobile experience</p>
            </div>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=online.yourtrace.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 whitespace-nowrap"
          >
            Get on Google Play
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/40 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/trending" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Trending
                </Link>
              </li>
              <li>
                <Link href="/feed" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Your Feed
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/40 mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/research" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Research
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Tools
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/40 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/privacy-policy" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-secondary hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/40 mb-4">
              Connect
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://x.com/tarat_211"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary hover:text-foreground transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/TarunTomar122"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:yourtrace.online@gmail.com"
                  className="text-sm text-secondary hover:text-foreground transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span className="text-xs font-semibold tracking-[0.16em] text-secondary">TRACE</span>
          </div>
          <p className="text-xs text-secondary/40">
            {new Date().getFullYear()} Trace. Many sources, one story view.
          </p>
        </div>
      </div>
    </footer>
  );
}
