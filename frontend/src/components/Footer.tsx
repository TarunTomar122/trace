import Link from 'next/link';

export default function Footer() {
  const googlePlayUrl = "/api/affiliate/outbound?target=android_app&next=" + encodeURIComponent("https://play.google.com/store/apps/details?id=online.yourtrace.app");
  return (
    <footer className="border-t border-border/[0.06] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Android App Callout */}
        <div className="mb-14 flex flex-col items-start justify-between gap-6 rounded-[20px] border border-border/[0.08] bg-surface/50 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shrink-0">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-semibold">Trace is on Android</p>
              <p className="text-[13px] text-secondary/60">Get the app for the best mobile experience</p>
            </div>
          </div>
          <a
            href={googlePlayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 whitespace-nowrap"
          >
            Get on Google Play
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/trending" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Trending
                </Link>
              </li>
              <li>
                <Link href="/daily" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Daily Archive
                </Link>
              </li>
              <li>
                <Link href="/compare" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Compare
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/research" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Research
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Tools
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/privacy-policy" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-4">
              Connect
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://x.com/tarat_211"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-secondary/60 hover:text-foreground transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/TarunTomar122"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-secondary/60 hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:tomartarun2001@gmail.com"
                  className="text-[13px] text-secondary/60 hover:text-foreground transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-4 w-auto" />
            <span className="text-[11px] font-semibold tracking-[0.18em] text-secondary/40">TRACE</span>
          </div>
          <p className="text-[11px] text-secondary/30">
            {new Date().getFullYear()} Trace. Many sources, one story view.
          </p>
        </div>
      </div>
    </footer>
  );
}
