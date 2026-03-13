import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border/30 mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Android App Callout */}
        <div className="mb-12 p-5 rounded-lg bg-surface-secondary flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-background" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Trace is on Android</p>
              <p className="text-xs text-secondary">Get the app for the best mobile experience</p>
            </div>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=online.yourtrace.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.39 12l2.308-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
            </svg>
            Get on Google Play
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary/50 mb-4">
              Product
            </h4>
            <ul className="space-y-2">
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary/50 mb-4">
              Resources
            </h4>
            <ul className="space-y-2">
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary/50 mb-4">
              Legal
            </h4>
            <ul className="space-y-2">
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary/50 mb-4">
              Connect
            </h4>
            <ul className="space-y-2">
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

        <div className="pt-8 border-t border-sidebar-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span className="text-xs font-semibold tracking-[0.12em] text-secondary">TRACE</span>
          </div>
          <p className="text-xs text-secondary/50">
            {new Date().getFullYear()} Trace. Many sources, one story view.
          </p>
        </div>
      </div>
    </footer>
  );
}
