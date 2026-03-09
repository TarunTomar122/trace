import Link from 'next/link';

const PRODUCT_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/trending', label: 'Trending Topics' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#get-started', label: 'Get Started' },
];

const RESOURCE_LINKS = [
  { href: '/research', label: 'Research & Insights' },
  { href: '/tools', label: 'Free Tools' },
  { href: '/tools/digest-preview', label: 'Digest Preview' },
];

const LEGAL_LINKS = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/contact', label: 'Contact Us' },
];

const SOCIAL_LINKS = [
  { href: 'https://x.com/tarat_211', label: 'Twitter / X', external: true },
  { href: 'https://github.com/TarunTomar122', label: 'GitHub', external: true },
  { href: 'mailto:yourtrace.online@gmail.com', label: 'Email Us', external: true },
];

export default function Footer() {
  return (
    <footer className="bg-surface-secondary border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
              Connect
            </h4>
            <ul className="space-y-3">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="text-sm text-secondary hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile App */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
              Mobile App
            </h4>
            <ul className="space-y-3">
              <li className="text-sm text-secondary">
                Grouped topics, timelines, and For You cards built for quick catch-up on your phone.
              </li>
              <li>
                <a
                  href="https://play.google.com/store/apps/details?id=online.yourtrace.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary hover:text-foreground transition-colors underline underline-offset-4"
                >
                  Get it on Google Play
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <img
                src="/trace.webp"
                alt="Trace Logo"
                width={120}
                height={40}
                className="h-6 w-auto"
              />
              <span className="text-sm font-semibold tracking-wider uppercase text-foreground">
                Trace
              </span>
            </div>

            {/* Tagline + Copyright */}
            <div className="text-sm text-secondary">
              <p className="mb-1">Many sources. One story view. Better decisions.</p>
              <p className="text-xs text-secondary/50">© {new Date().getFullYear()} Trace. All rights reserved.</p>
            </div>
          </div>

          {/* SEO keyword links */}
          <div className="mt-8 pt-6 border-t border-border/30">
            <p className="text-xs text-secondary/40 leading-relaxed">
              <Link href="/trending" className="hover:text-secondary transition-colors">Live topic pages</Link>
              {' · '}
              <Link href="/trending" className="hover:text-secondary transition-colors">Trending topics</Link>
              {' · '}
              <Link href="/research" className="hover:text-secondary transition-colors">Research articles</Link>
              {' · '}
              <Link href="/tools" className="hover:text-secondary transition-colors">Free tools</Link>
              {' · '}
              <Link href="/tools/digest-preview" className="hover:text-secondary transition-colors">Digest preview</Link>
              {' · '}
              <Link href="/" className="hover:text-secondary transition-colors">AI overviews</Link>
              {' · '}
              <Link href="/" className="hover:text-secondary transition-colors">Deep dives</Link>
              {' · '}
              <Link href="/" className="hover:text-secondary transition-colors">RSS alternative</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
