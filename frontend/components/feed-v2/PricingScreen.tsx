import Link from 'next/link';
import ProCheckoutButton from './ProCheckoutButton';

const PLANS = [
  {
    tag: 'Free',
    price: '$0',
    per: '/month',
    note: 'Everything you need to start catching up.',
    cta: { label: 'Start reading', href: '/feed' },
    features: [
      'A personalized AI and tech news feed',
      '30 headlines in every new Chrome tab',
      'Five unique AI summaries every day',
      'Unlimited original source links',
      'Topic filters for the stories you follow',
      'Bookmarks with a free Trace account',
    ],
  },
  {
    tag: 'Trace Pro',
    price: '$3',
    per: '/month',
    note: 'The whole day, ranked and summarized, every morning.',
    cta: { label: 'Try Pro free for 3 days', href: '' },
    features: [
      'Unlimited AI summaries in the web feed',
      'The complete ranked daily edition',
      'Search your complete saved archive',
      'The complete daily news archive',
      'Full personalized Pulse: tools, discussions, worth reading',
      'Read-only Agent Access',
    ],
  },
];

export default function PricingScreen() {
  return (
    <main className="pr">
      <style>{css}</style>
      <header className="nav">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace.webp" alt="Trace" className="brand-logo" />
          <span className="wordmark">Trace</span>
        </Link>
        <Link href="/feed" className="nav-cta">Open the feed</Link>
      </header>

      <section className="hero">
        <p className="kicker">Pricing</p>
        <h1 className="title">Save 45+ minutes every morning.</h1>
        <p className="sub">Trace reads 400+ sources overnight, ranks what matters, and hands you the 25 stories worth your time.</p>
      </section>

      <section className="plans">
        {PLANS.map((p) => (
          <article key={p.tag} className={`plan${p.tag === 'Trace Pro' ? ' pro' : ''}`}>
            <p className="plan-tag">{p.tag}</p>
            <p className="plan-price">{p.price}<span>{p.per}</span></p>
            <p className="plan-note">{p.note}</p>
            <ul className="plan-list">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {p.tag === 'Trace Pro' ? (
              <ProCheckoutButton className="btn" label={p.cta.label} busyLabel="Opening checkout…" />
            ) : (
              <a href={p.cta.href} className="btn">
                {p.cta.label}
              </a>
            )}
          </article>
        ))}
      </section>

      <section className="fine">
        <p>Every plan includes the daily ranked feed, original source links, and the Chrome new tab experience. Pro adds unlimited summaries, the complete archive, full Pulse, and agent access.</p>
        <p>Cancel anytime, in one click, no retention call.</p>
      </section>

      <footer className="foot">
        <Link href="/">← Back to the landing page</Link>
      </footer>
    </main>
  );
}

const css = `
.pr {
  --ink: #0f1419; --text-2: #536471; --text-3: #71767b;
  --line: #eff3f4; --hover: #f7f9f9; --blue: #1d9bf0;
  background: #fff; color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
}
.pr .nav {
  max-width: 1100px; margin: 0 auto; padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.pr .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--ink); }
.pr .brand-logo { height: 28px; width: auto; }
.pr .wordmark { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
.pr .nav-cta {
  background: var(--blue); color: #fff; text-decoration: none;
  padding: 9px 18px; border-radius: 9999px; font-size: 14px; font-weight: 700;
}
.pr .nav-cta:hover { background: #1a8cd8; }
.pr .hero { max-width: 720px; margin: 0 auto; padding: 56px 20px 20px; text-align: center; }
.pr .kicker { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-2); margin: 0 0 12px; }
.pr .title { margin: 0 0 12px; font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
.pr .sub { margin: 0; font-size: 17px; color: var(--text-2); line-height: 1.55; }
.pr .plans {
  max-width: 820px; margin: 36px auto 0; padding: 0 20px;
  display: grid; grid-template-columns: 1fr; gap: 18px;
}
@media (min-width: 780px) { .pr .plans { grid-template-columns: 1fr 1fr; } }
.pr .plan { border: 1px solid var(--line); border-radius: 20px; padding: 28px 26px; display: flex; flex-direction: column; }
.pr .plan.pro { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue); }
.pr .plan-tag { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2); }
.pr .plan-price { margin: 8px 0 6px; font-size: 44px; font-weight: 800; letter-spacing: -0.03em; }
.pr .plan-price span { font-size: 16px; font-weight: 500; color: var(--text-2); }
.pr .plan-note { margin: 0 0 18px; font-size: 15px; color: var(--text-2); line-height: 1.5; }
.pr .plan-list { margin: 0 0 24px; padding: 0; list-style: none; flex: 1; }
.pr .plan-list li { padding: 6px 0 6px 26px; position: relative; font-size: 15px; line-height: 1.45; }
.pr .plan-list li::before { content: '✓'; position: absolute; left: 0; color: var(--blue); font-weight: 700; }
.pr .btn {
  display: flex; align-items: center; justify-content: center; height: 48px; width: 100%;
  border: none; border-radius: 9999px; background: var(--blue); color: #fff;
  font-size: 16px; font-weight: 700; text-decoration: none; font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.pr .btn:disabled { opacity: 0.7; cursor: wait; }
.pr .btn:hover { background: #1a8cd8; }
.pr .fine { max-width: 640px; margin: 0 auto; padding: 28px 20px 56px; }
.pr .fine p { font-size: 14px; line-height: 1.65; color: var(--text-3); margin: 0 0 8px; }
.pr .foot { max-width: 1100px; margin: 0 auto; padding: 0 20px 40px; }
.pr .foot a { color: var(--text-2); text-decoration: none; font-size: 14px; }
.pr .foot a:hover { color: var(--ink); }
`;
