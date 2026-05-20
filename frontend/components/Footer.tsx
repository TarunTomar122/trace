import Image from 'next/image';
import Link from 'next/link';

export default function Footer({ variant = 'default' }: { variant?: 'default' | 'landing' } = {}) {
  const googlePlayUrl =
    '/api/affiliate/outbound?target=android_app&next=' +
    encodeURIComponent('https://play.google.com/store/apps/details?id=online.yourtrace.app');

  if (variant === 'landing') {
    return (
      <footer className="relative mt-28 overflow-hidden border-t border-[#e5e7eb] bg-white px-4 py-16 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none text-center">
          <p className="text-[clamp(4rem,15vw,10rem)] font-bold leading-none tracking-[-0.04em] text-[#f3f4f6]">
            TRACE
          </p>
        </div>
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-10 flex flex-col items-start justify-between gap-6 rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: '#eff6ff', color: '#2563eb' }}
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111827]">Trace is on Android</p>
                <p className="text-[13px] text-[#6b7280]">Get the app for the best mobile experience</p>
              </div>
            </div>
            <a
              href={googlePlayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn landing-btn-sm whitespace-nowrap"
              style={{ background: '#111827', color: '#fff', padding: '0.75rem 1.5rem' }}
            >
              Get on Google Play
            </a>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/trace.webp" alt="Trace" width={18} height={18} className="h-[18px] w-auto" />
              <span className="text-[12px] font-bold tracking-[0.12em] text-[#9ca3af]">TRACE</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#6b7280]">
              <Link href="/blog" className="transition-colors hover:text-[#111827]">
                Blog
              </Link>
              <Link href="/compare" className="transition-colors hover:text-[#111827]">
                Compare
              </Link>
              <Link href="/privacy-policy" className="transition-colors hover:text-[#111827]">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-[#111827]">
                Terms
              </Link>
              <Link href="/contact" className="transition-colors hover:text-[#111827]">
                Contact
              </Link>
            </div>
          </div>
          <p className="mt-8 text-center text-[12px] text-[#9ca3af]">
            © {new Date().getFullYear()} Trace. All rights reserved.
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border/[0.06] mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 pb-20">
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
                <Link href="/blog" className="text-[13px] text-secondary/60 hover:text-foreground transition-colors">
                  Blog
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
            <Image src="/trace.webp" alt="Trace" width={16} height={16} className="h-4 w-auto" />
            <span className="text-[11px] font-semibold tracking-[0.18em] text-secondary/40">TRACE</span>
          </div>
          <p className="text-[11px] text-secondary/30">
            {new Date().getFullYear()} Trace. Many sources, one story view.
          </p>
        </div>

        <div className="flex justify-center pt-8">
          <a
            href="https://www.aidirectori.es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block opacity-90 transition-opacity hover:opacity-100"
          >
            <img
              src="https://cdn.aidirectori.es/ai-tools/badges/light-mode.png"
              alt="AI Directories Badge"
              className="h-auto max-h-14 w-auto"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
