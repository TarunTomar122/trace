import Link from "next/link";

export default function StoryWireFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="story-wire-footer">
      <div className="story-wire-footer-inner">
        <div className="story-wire-footer-brand">
          <Link href="/feed" className="story-wire-footer-logo">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span>TRACE</span>
          </Link>
          <p className="story-wire-footer-tagline">Many sources, one story view.</p>
        </div>

        <nav className="story-wire-footer-nav" aria-label="Footer">
          <Link href="/feed">Feed</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <p className="story-wire-footer-copy">
          © {year} Trace
        </p>
      </div>
    </footer>
  );
}
