import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * New-design shell for content pages (blog, compare, legal, etc.).
 * Re-maps the legacy design tokens to the X-light palette inside its scope,
 * so existing pages re-skin automatically without touching their internals.
 */
export default function PageShell({ children, wide = false, chrome = true }: { children: ReactNode; wide?: boolean; chrome?: boolean }) {
  const styleEl = <style>{css}</style>;

  if (!chrome) {
    // token remap + font only: no chrome (pages that render their own header/footer)
    return (
      <div className="pg pg-nochrome">
        {styleEl}
        {children}
      </div>
    );
  }

  return (
    <div className="pg">
      {styleEl}
      <header className="pg-nav">
        <div className="pg-nav-in">
          <Link href="/" className="pg-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trace.webp" alt="Trace" className="pg-logo" />
            <span className="pg-wordmark">Trace</span>
          </Link>
          <nav className="pg-links">
            <Link href="/feed">Feed</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/subscribe">Pricing</Link>
          </nav>
        </div>
      </header>
      <div className={`pg-body${wide ? ' wide' : ''}`}>{children}</div>
      <footer className="pg-footer">
        <div className="pg-foot-in">
          <span className="pg-foot-brand">Trace</span>
          <span className="pg-foot-links">
            <Link href="/feed">Feed</Link>
            <Link href="/subscribe">Pricing</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </span>
          <span className="pg-foot-copy">Built by Tarat · © 2026</span>
        </div>
      </footer>
    </div>
  );
}

const css = `
.pg {
  /* re-map legacy tokens to the new X-light palette */
  --background: #ffffff;
  --foreground: #0f1419;
  --primary: #0f1419;
  --primary-foreground: #ffffff;
  --secondary: #536471;
  --border: #eff3f4;
  --surface: #ffffff;
  --surface-secondary: #f7f9f9;
  --surface-tertiary: #eff3f4;
  --accent: #1d9bf0;
  --accent-foreground: #ffffff;
  --tab-inactive: #71767b;
  background: #ffffff;
  color: var(--foreground);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
}
.pg-nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(255,255,255,0.88); backdrop-filter: blur(12px); z-index: 100; }
.pg-nav-in { max-width: 1100px; margin: 0 auto; padding: 0 20px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
.pg-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--foreground); }
.pg-logo { height: 28px; width: auto; }
.pg-wordmark { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
.pg-links { display: flex; align-items: center; gap: 20px; }
.pg-links a { color: var(--text-2, #536471); text-decoration: none; font-size: 14px; font-weight: 550; }
.pg-links a:hover { color: var(--foreground); }
.pg-body { max-width: 720px; margin: 0 auto; padding: 44px 20px 72px; }
.pg-body.wide { max-width: 1000px; }
.pg-body h1 { font-size: clamp(1.9rem, 4vw, 2.7rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
.pg-body h2 { font-size: 22px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.25; margin-top: 2.2em; }
.pg-body a { color: #1d9bf0; }
.pg-footer { border-top: 1px solid var(--line); }
.pg-foot-in { max-width: 1100px; margin: 0 auto; padding: 22px 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; }
.pg-foot-brand { font-weight: 800; font-size: 15px; }
.pg-foot-links { display: flex; flex-wrap: wrap; gap: 16px; }
.pg-foot-links a { color: #536471; text-decoration: none; font-size: 13.5px; }
.pg-foot-links a:hover { color: var(--foreground); }
.pg-foot-copy { font-size: 13px; color: #71767b; }
`;
