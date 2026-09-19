'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ProCheckoutButton from './ProCheckoutButton';
import { useAuth } from '@/contexts/AuthContext';
import { hasActiveSubscription } from '@/lib/subscription-access';
import { SUBSCRIPTION_PRICE_DEFAULT, priceAmountDisplay, shortPriceDisplay } from '@/lib/subscription-pricing';

const FREE_FEATURES = [
  'Your ranked daily feed',
  '31 headlines in every new Chrome tab',
  '4 stories as a guest, 5 with a free account',
  'Unlimited original source links',
  'Topic filters and For you ranking',
  'Bookmarks with a free Trace account',
  'Daily email brief (opt-in)',
];

const PRO_FEATURES = [
  'Unlimited summaries in the web feed',
  'The complete ranked daily edition',
  'The full daily news archive',
  'Search your saved archive',
  'Full personalized Pulse: tools and discussions',
  'Read-only Agent Access',
];

export default function PricingScreen() {
  const { profile } = useAuth();
  const isPro = hasActiveSubscription(profile);
  const [priceDisplay, setPriceDisplay] = useState(SUBSCRIPTION_PRICE_DEFAULT);

  // Server-resolved display price (India sees ₹, everyone else USD).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription/pricing', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.priceDisplay === 'string') setPriceDisplay(data.priceDisplay);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, []);

  const proLabel = `Go Pro — ${shortPriceDisplay(priceDisplay)}`;

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
        <p className="sub">Trace reads 400+ sources overnight, ranks what matters, and hands you the stories worth your time.</p>
      </section>

      <section className="plans">
        <article className="plan">
          <p className="plan-tag">Free</p>
          <p className="plan-price">$0<span>/month</span></p>
          <p className="plan-note">Everything you need to start catching up.</p>
          <ul className="plan-list">
            {FREE_FEATURES.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <Link href="/feed?utm_source=site&utm_medium=pricing_free" className="btn">Start reading free</Link>
        </article>

        <article className="plan pro">
          <p className="plan-tag">Trace Pro</p>
          <p className="plan-price">{priceAmountDisplay(priceDisplay)}<span>/month</span></p>
          <p className="plan-note">The whole day, ranked and summarized, every morning.</p>
          <ul className="plan-list">
            {PRO_FEATURES.map((f) => <li key={f}>{f}</li>)}
          </ul>
          {isPro ? (
            <Link href="/feed?tab=profile" className="btn">You&rsquo;re on Pro — manage plan</Link>
          ) : (
            <ProCheckoutButton className="btn" label={proLabel} busyLabel="Opening checkout…" />
          )}
        </article>
      </section>

      <section className="fine">
        <p>Every plan includes the daily ranked feed, original source links, and the Chrome new tab experience. Pro adds unlimited summaries, the complete archive, full Pulse, and agent access.</p>
        <p>Cancel anytime from Profile — no retention call.</p>
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
